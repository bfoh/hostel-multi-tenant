import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'

/**
 * Ghana statutory taxes the platform tracks via the seeded chart of accounts.
 * Codes mirror migration 007 (seed_ghana_coa).
 */
const TAX_ACCOUNT_CODES = {
  vatPayable:    '2100',  // VAT 15%
  nhilPayable:   '2110',  // NHIL 2.5%
  getfundPayable:'2120',  // GETFund 2.5%
  payeePayable:  '2200',
  ssnitEmployer: '2210',
  ssnitEmployee: '2220',
} as const

export interface TaxReturnSummary {
  year:           number
  month:          number
  monthLabel:     string
  periodStart:    string
  periodEnd:      string
  vat:            { charged: number; reclaimed: number; netDue: number }
  nhil:           number
  getfund:        number
  totalLevies:    number
  paye:           number
  ssnitEmployer:  number
  ssnitEmployee:  number
  totalPayroll:   number
  grandTotal:     number
}

export interface FilingObligation {
  id:            string  // e.g. "vat-2026-04"
  kind:          'VAT + NHIL + GETFund' | 'PAYE' | 'SSNIT'
  period:        string  // 'Apr 2026'
  year:          number
  month:         number
  dueDate:       string  // YYYY-MM-DD
  amountDue:     number  // pesewas (current accumulation, may change as the period closes)
  daysUntilDue:  number
  status:        'upcoming' | 'due-soon' | 'overdue'
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

async function liabilityActivity(
  tenantId: string,
  code:     string,
  from:     string,
  to:       string,
): Promise<number> {
  const supabase = createAdminClient()
  const { data } = await (supabase as any)
    .from('journal_lines')
    .select(`
      debit, credit,
      entry:journal_entries!inner(entry_date),
      account:chart_of_accounts!inner(code, type, tenant_id)
    `)
    .eq('tenant_id', tenantId)
    .eq('account.code', code)
    .gte('journal_entries.entry_date', from)
    .lte('journal_entries.entry_date', to)

  // Liabilities are credit-normal — net activity = credit - debit
  let total = 0
  for (const row of (data ?? []) as any[]) {
    total += (row.credit as number) - (row.debit as number)
  }
  return total
}

export async function getTaxReturn(year: number, month: number): Promise<TaxReturnSummary | null> {
  const tenantId = await getServerTenantId()
  if (!tenantId) return null

  const mm = String(month).padStart(2, '0')
  const periodStart = `${year}-${mm}-01`
  const periodEnd   = `${year}-${mm}-${String(daysInMonth(year, month)).padStart(2, '0')}`

  const [vatCharged, nhil, getfund, paye, ssnitEmployer, ssnitEmployee] = await Promise.all([
    liabilityActivity(tenantId, TAX_ACCOUNT_CODES.vatPayable,    periodStart, periodEnd),
    liabilityActivity(tenantId, TAX_ACCOUNT_CODES.nhilPayable,   periodStart, periodEnd),
    liabilityActivity(tenantId, TAX_ACCOUNT_CODES.getfundPayable,periodStart, periodEnd),
    liabilityActivity(tenantId, TAX_ACCOUNT_CODES.payeePayable,  periodStart, periodEnd),
    liabilityActivity(tenantId, TAX_ACCOUNT_CODES.ssnitEmployer, periodStart, periodEnd),
    liabilityActivity(tenantId, TAX_ACCOUNT_CODES.ssnitEmployee, periodStart, periodEnd),
  ])

  // Input VAT (reclaimed) isn't tracked separately in the seeded COA — left at 0
  // so the netDue equals output VAT. Wire in once a 1400 Input VAT account exists.
  const vatReclaimed = 0
  const netVat = vatCharged - vatReclaimed

  const totalPayroll = paye + ssnitEmployer + ssnitEmployee

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('en-GH', { month: 'long', year: 'numeric' })

  return {
    year,
    month,
    monthLabel,
    periodStart,
    periodEnd,
    vat: { charged: vatCharged, reclaimed: vatReclaimed, netDue: netVat },
    nhil,
    getfund,
    totalLevies: nhil + getfund,
    paye,
    ssnitEmployer,
    ssnitEmployee,
    totalPayroll,
    grandTotal: netVat + nhil + getfund + paye + ssnitEmployer + ssnitEmployee,
  }
}

/**
 * Generates 6 forward-looking filing obligations from "now":
 *   VAT + NHIL + GETFund — due last day of the following month
 *   PAYE                  — due 15th of the following month
 *   SSNIT                 — due 14th of the following month
 *
 * Amount due is the period's accumulated liability activity at read-time.
 */
export async function getFilingCalendar(): Promise<FilingObligation[]> {
  const tenantId = await getServerTenantId()
  if (!tenantId) return []

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const obligations: FilingObligation[] = []

  // Look at the period itself = previous month and the current month (whose filing falls in next month)
  const periods: { year: number; month: number }[] = []
  for (let offset = -1; offset <= 1; offset++) {
    const d = new Date(today.getFullYear(), today.getMonth() + offset, 1)
    periods.push({ year: d.getFullYear(), month: d.getMonth() + 1 })
  }

  const calcDueDate = (kind: FilingObligation['kind'], year: number, month: number): Date => {
    // Filing month = period month + 1
    const filingMonthDate = new Date(year, month, 1)  // month is 1-based, so this is the first of the *next* calendar month
    if (kind === 'PAYE') {
      filingMonthDate.setDate(15)
    } else if (kind === 'SSNIT') {
      filingMonthDate.setDate(14)
    } else {
      // last day of the filing month
      filingMonthDate.setMonth(filingMonthDate.getMonth() + 1)
      filingMonthDate.setDate(0)
    }
    return filingMonthDate
  }

  const status = (daysUntilDue: number): FilingObligation['status'] => {
    if (daysUntilDue < 0)  return 'overdue'
    if (daysUntilDue <= 7) return 'due-soon'
    return 'upcoming'
  }

  for (const p of periods) {
    const ret = await getTaxReturn(p.year, p.month)
    if (!ret) continue
    const periodLabel = ret.monthLabel
    const kinds: { kind: FilingObligation['kind']; amount: number }[] = [
      { kind: 'VAT + NHIL + GETFund', amount: ret.vat.netDue + ret.nhil + ret.getfund },
      { kind: 'PAYE',                  amount: ret.paye },
      { kind: 'SSNIT',                 amount: ret.ssnitEmployer + ret.ssnitEmployee },
    ]
    for (const { kind, amount } of kinds) {
      const due = calcDueDate(kind, p.year, p.month)
      const daysUntilDue = Math.floor((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
      obligations.push({
        id:        `${kind.toLowerCase().replace(/[^a-z]+/g, '-')}-${p.year}-${String(p.month).padStart(2, '0')}`,
        kind,
        period:    periodLabel,
        year:      p.year,
        month:     p.month,
        dueDate:   due.toISOString().slice(0, 10),
        amountDue: Math.max(0, amount),
        daysUntilDue,
        status:    status(daysUntilDue),
      })
    }
  }

  return obligations.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}
