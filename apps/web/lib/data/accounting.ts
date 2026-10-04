import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { getBookingFinancialSummary } from '@/lib/data/booking-finance'

/* ── Types ────────────────────────────────────────────────────────────── */

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'

export interface Account {
  id: string
  code: string
  name: string
  type: AccountType
  is_system: boolean
  is_active: boolean
  sort_order: number
}

export interface JournalEntry {
  id: string
  entry_date: string
  reference: string | null
  description: string
  source: string
  source_id: string | null
  created_at: string
  voided_at:         string | null
  void_reason:       string | null
  reverses_entry_id: string | null
  lines: {
    id: string
    account: { code: string; name: string; type: AccountType } | null
    description: string | null
    debit: number
    credit: number
  }[]
}

export interface TrialBalanceLine {
  account_id: string
  code: string
  name: string
  type: AccountType
  total_debit: number
  total_credit: number
  balance: number  // debit-normal: debit - credit; credit-normal: credit - debit
}

export interface PnLReport {
  period_start: string
  period_end: string
  revenue: { account_id: string; code: string; name: string; amount: number }[]
  expenses: { account_id: string; code: string; name: string; amount: number }[]
  totalRevenue: number
  totalExpenses: number
  netProfit: number
}

/* ── Chart of accounts ────────────────────────────────────────────────── */

export async function getChartOfAccounts(): Promise<Account[]> {
  const tenantId = await getServerTenantId()
  if (!tenantId) return []

  const supabase = createAdminClient()
  const { data } = await (supabase as any)
    .from('chart_of_accounts')
    .select('id, code, name, type, is_system, is_active, sort_order')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  return (data ?? []) as Account[]
}

/* ── Journal entries ──────────────────────────────────────────────────── */

export interface JournalEntryFilters {
  source?:    string
  dateFrom?:  string
  dateTo?:    string
  accountId?: string
}

export async function getJournalEntries(
  limit = 50,
  offset = 0,
  filters: JournalEntryFilters = {},
): Promise<JournalEntry[]> {
  const tenantId = await getServerTenantId()
  if (!tenantId) return []

  const supabase = createAdminClient()

  // If filtering by account, first find entry IDs that touch that account
  let entryIdFilter: string[] | null = null
  if (filters.accountId) {
    const { data: matchingLines } = await (supabase as any)
      .from('journal_lines')
      .select('entry_id')
      .eq('tenant_id', tenantId)
      .eq('account_id', filters.accountId)
    entryIdFilter = Array.from(new Set(((matchingLines ?? []) as any[]).map((l) => l.entry_id as string)))
    if (entryIdFilter.length === 0) return []
  }

  let q = (supabase as any)
    .from('journal_entries')
    .select(`
      id, entry_date, reference, description, source, source_id, created_at,
      voided_at, void_reason, reverses_entry_id,
      lines:journal_lines(
        id, description, debit, credit,
        account:chart_of_accounts(code, name, type)
      )
    `)
    .eq('tenant_id', tenantId)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (filters.source)   q = q.eq('source', filters.source)
  if (filters.dateFrom) q = q.gte('entry_date', filters.dateFrom)
  if (filters.dateTo)   q = q.lte('entry_date', filters.dateTo)
  if (entryIdFilter)    q = q.in('id', entryIdFilter)

  const { data } = await q

  return ((data ?? []) as any[]).map((e) => ({
    ...e,
    lines: ((e.lines ?? []) as any[]).map((l: any) => ({
      ...l,
      account: Array.isArray(l.account) ? l.account[0] ?? null : l.account ?? null,
    })),
  })) as JournalEntry[]
}

/* ── Trial balance ────────────────────────────────────────────────────── */

export async function getTrialBalance(
  dateFrom?: string,
  dateTo?: string,
): Promise<TrialBalanceLine[]> {
  const tenantId = await getServerTenantId()
  if (!tenantId) return []

  const supabase = createAdminClient()

  const { data, error } = await (supabase as any).rpc('get_trial_balance', {
    p_tenant_id: tenantId,
    p_date_from: dateFrom ?? null,
    p_date_to: dateTo ?? null,
  })
  if (error) {
    console.error('[accounting] trial balance query failed', error)
    return []
  }

  return ((data ?? []) as any[]).map((row) => ({
    ...row,
    total_debit: Number(row.total_debit ?? 0),
    total_credit: Number(row.total_credit ?? 0),
    balance: Number(row.balance ?? 0),
  })) as TrialBalanceLine[]
}

/* ── P&L statement ────────────────────────────────────────────────────── */

export async function getPnL(dateFrom: string, dateTo: string): Promise<PnLReport> {
  const tb = await getTrialBalance(dateFrom, dateTo)

  const revAccts = tb.filter((a) => a.type === 'revenue')
  const expAccts = tb.filter((a) => a.type === 'expense')

  const totalRevenue  = revAccts.reduce((s, a) => s + a.balance, 0)
  const totalExpenses = expAccts.reduce((s, a) => s + a.balance, 0)

  return {
    period_start: dateFrom,
    period_end:   dateTo,
    revenue:  revAccts.map((a) => ({ account_id: a.account_id, code: a.code, name: a.name, amount: a.balance })),
    expenses: expAccts.map((a) => ({ account_id: a.account_id, code: a.code, name: a.name, amount: a.balance })),
    totalRevenue,
    totalExpenses,
    netProfit: totalRevenue - totalExpenses,
  }
}

/* ── Balance sheet ────────────────────────────────────────────────────── */

export async function getBalanceSheet(asOf: string) {
  const tb = await getTrialBalance(undefined, asOf)

  const assets      = tb.filter((a) => a.type === 'asset')
  const liabilities = tb.filter((a) => a.type === 'liability')
  const currentEarnings = tb
    .filter((a) => a.type === 'revenue')
    .reduce((sum, account) => sum + account.balance, 0)
    - tb
      .filter((a) => a.type === 'expense')
      .reduce((sum, account) => sum + account.balance, 0)
  const equity: TrialBalanceLine[] = [
    ...tb.filter((a) => a.type === 'equity'),
    {
      account_id: 'current-earnings',
      code: '3999',
      name: 'Current earnings',
      type: 'equity',
      total_debit: currentEarnings < 0 ? Math.abs(currentEarnings) : 0,
      total_credit: currentEarnings > 0 ? currentEarnings : 0,
      balance: currentEarnings,
    },
  ]

  const totalAssets      = assets.reduce((s, a) => s + a.balance, 0)
  const totalLiabilities = liabilities.reduce((s, a) => s + a.balance, 0)
  const totalEquity      = equity.reduce((s, a) => s + a.balance, 0)

  return { assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity, asOf }
}

/* ── Cash flow statement ──────────────────────────────────────────────── */

export interface CashFlowReport {
  period_start: string
  period_end:   string
  operating: {
    label:  string
    amount: number
  }[]
  totalOperating: number
  netChange:      number
}

/**
 * Direct-method cash flow built from journal lines that touch till cash (1010)
 * or bank/mobile-money cash (1020).
 * Debits to cash = inflows; credits to cash = outflows.
 * Groups by journal entry source for a meaningful breakdown.
 */
export async function getCashFlow(dateFrom: string, dateTo: string): Promise<CashFlowReport> {
  const tenantId = await getServerTenantId()
  if (!tenantId) return { period_start: dateFrom, period_end: dateTo, operating: [], totalOperating: 0, netChange: 0 }

  const supabase = createAdminClient()
  const { data, error } = await (supabase as any).rpc('get_cash_flow_by_source', {
    p_tenant_id: tenantId,
    p_date_from: dateFrom,
    p_date_to: dateTo,
  })
  if (error) throw new Error(`Could not load cash flow: ${error.message}`)

  const SOURCE_LABELS: Record<string, string> = {
    booking_payment:     'Room payment receipts',
    booking_charge:      'Folio charge receipts',
    damage_deposit:      'Damage deposits (net)',
    payroll:             'Staff payroll payments',
    expense:             'Operating expense payments',
    refund:              'Refunds paid',
    bank_reconciliation: 'Bank reconciliation adjustments',
    manual:              'Manual entries',
  }

  const operating: CashFlowReport['operating'] = []

  for (const row of (data ?? []) as any[]) {
    const src = String(row.source ?? 'other')
    const inflow = Number(row.total_inflow ?? 0)
    const outflow = Number(row.total_outflow ?? 0)
    const net = inflow - outflow
    if (net === 0) continue
    operating.push({
      label:  SOURCE_LABELS[src] ?? src,
      amount: net,
    })
  }

  // Sort: positive (inflows) first
  operating.sort((a, b) => b.amount - a.amount)

  const totalOperating = operating.reduce((s, r) => s + r.amount, 0)

  return { period_start: dateFrom, period_end: dateTo, operating, totalOperating, netChange: totalOperating }
}

/* ── KPI summary ──────────────────────────────────────────────────────── */

export interface MonthlyTrendPoint {
  month:       string  // YYYY-MM
  label:       string  // 'Jan 26'
  revenue:     number
  expenses:    number
  netProfit:   number
}

export interface FinancialHealth {
  asOf:               string
  cashPosition:       number
  arOutstanding:      number
  apOutstanding:      number
  vatPayable:         number
  payeAndSsnitPayable:number
  currentAssets:      number
  currentLiabilities: number
  totalAssets:        number
  totalLiabilities:   number
  totalEquity:        number
  ratios: {
    netMargin:     number | null  // 0..1
    currentRatio:  number | null
    quickRatio:    number | null
    debtToEquity:  number | null
  }
  mtd: { revenue: number; expenses: number; netProfit: number; bookingRevenue: number; otherRevenue: number }
  ytd: { revenue: number; expenses: number; netProfit: number; bookingRevenue: number; otherRevenue: number }
  cashRunwayMonths:   number | null
  monthlyTrend:       MonthlyTrendPoint[]
  topRevenueMtd:      { account_id: string; code: string; name: string; amount: number }[]
  topExpensesMtd:     { account_id: string; code: string; name: string; amount: number }[]
  integrity: {
    paymentJournalGaps:        number
    chargeJournalGaps:         number
    depositJournalGaps:        number
    unbalancedJournals:        number
    crossTenantJournalLines:   number
    bookingBalanceMismatches:  number
    cancelledRevenueExposure: number
    depositLiabilityMismatches:number
    totalIssues:               number
  }
}

export async function getFinancialHealth(): Promise<FinancialHealth | null> {
  const tenantId = await getServerTenantId()
  if (!tenantId) return null

  const supabase = createAdminClient()

  const now = new Date()
  const y   = now.getFullYear()
  const m   = String(now.getMonth() + 1).padStart(2, '0')
  const today    = now.toISOString().slice(0, 10)
  const mtdStart = `${y}-${m}-01`
  const ytdStart = `${y}-01-01`

  // 6-month window starting first day of (now - 5) months
  const trendStartDate = new Date(y, now.getMonth() - 5, 1)
  const trendStart = trendStartDate.toISOString().slice(0, 10)

  const [tb, mtdPnL, ytdPnL, trendLines, bookingFinance, integrityResult] = await Promise.all([
    getTrialBalance(undefined, today),
    getPnL(mtdStart, today),
    getPnL(ytdStart, today),
    (supabase as any).rpc('get_monthly_financial_trend', {
      p_tenant_id: tenantId,
      p_date_from: trendStart,
      p_date_to: today,
    }),
    getBookingFinancialSummary(tenantId),
    (supabase as any).rpc('get_financial_integrity_summary', {
      p_tenant_id: tenantId,
    }),
  ])

  if (integrityResult.error || !integrityResult.data) {
    throw new Error(
      `Could not verify financial integrity: ${integrityResult.error?.message ?? 'empty response'}`,
    )
  }
  const integrityRow = integrityResult.data as Record<string, unknown>

  // Account-balance helpers
  const byCodePrefix = (prefix: string) => tb
    .filter((a) => a.code.startsWith(prefix))
    .reduce((s, a) => s + a.balance, 0)

  const cashPosition = byCodePrefix('10')                                       // 1010 + 1020
  // Booking invoices are currently maintained as an operational subledger;
  // they are not posted to the 1100 control account until cash is received.
  // Surface the canonical amount customers actually owe instead of a
  // misleading zero from the cash-basis general ledger.
  const arOutstanding = bookingFinance.outstanding
  const apOutstanding = byCodePrefix('2010')
  const vatPayable = ['2100', '2110', '2120'].reduce((s, c) => s + byCodePrefix(c), 0)
  const payeAndSsnitPayable = ['2200', '2210', '2220'].reduce((s, c) => s + byCodePrefix(c), 0)

  // Current = codes 10xx/11xx/12xx (assets), 20xx/21xx/22xx/23xx (liabilities)
  const currentAssets = tb
    .filter((a) => a.type === 'asset' && /^1[012]/.test(a.code))
    .reduce((s, a) => s + a.balance, 0)
  const currentLiabilities = tb
    .filter((a) => a.type === 'liability' && /^2[0123]/.test(a.code))
    .reduce((s, a) => s + a.balance, 0)

  const totalAssets      = tb.filter((a) => a.type === 'asset')    .reduce((s, a) => s + a.balance, 0)
  const totalLiabilities = tb.filter((a) => a.type === 'liability').reduce((s, a) => s + a.balance, 0)
  const currentEarnings = tb
    .filter((a) => a.type === 'revenue')
    .reduce((sum, account) => sum + account.balance, 0)
    - tb
      .filter((a) => a.type === 'expense')
      .reduce((sum, account) => sum + account.balance, 0)
  const totalEquity = tb
    .filter((a) => a.type === 'equity')
    .reduce((sum, account) => sum + account.balance, 0) + currentEarnings

  // Quick ratio = (current assets − inventory) / current liabilities
  const inventoryBalance = byCodePrefix('1300')

  const ratios = {
    netMargin: ytdPnL.totalRevenue > 0 ? ytdPnL.netProfit / ytdPnL.totalRevenue : null,
    currentRatio: currentLiabilities > 0 ? currentAssets / currentLiabilities : null,
    quickRatio: currentLiabilities > 0
      ? Math.max(0, currentAssets - inventoryBalance) / currentLiabilities
      : null,
    debtToEquity: totalEquity > 0 ? totalLiabilities / totalEquity : null,
  }

  // Aggregate trend by month + account type
  const monthlyMap = new Map<string, { revenue: number; expenses: number }>()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(y, now.getMonth() - i, 1)
    monthlyMap.set(d.toISOString().slice(0, 7), { revenue: 0, expenses: 0 })
  }

  for (const row of ((trendLines as any)?.data ?? []) as any[]) {
    const monthKey = String(row.month).slice(0, 7)
    const slot = monthlyMap.get(monthKey)
    if (!slot) continue
    slot.revenue += Number(row.revenue ?? 0)
    slot.expenses += Number(row.expenses ?? 0)
  }

  const monthlyTrend: MonthlyTrendPoint[] = Array.from(monthlyMap.entries()).map(([month, v]) => {
    const d = new Date(month + '-01')
    return {
      month,
      label:    d.toLocaleDateString('en-GH', { month: 'short', year: '2-digit' }),
      revenue:  v.revenue,
      expenses: v.expenses,
      netProfit: v.revenue - v.expenses,
    }
  })

  // Cash runway: average monthly burn over the last 3 months (only months with burn)
  const recentBurns = monthlyTrend.slice(-3).map((p) => p.expenses).filter((e) => e > 0)
  const avgBurn = recentBurns.length > 0
    ? recentBurns.reduce((s, n) => s + n, 0) / recentBurns.length
    : 0
  const cashRunwayMonths = avgBurn > 0 ? cashPosition / avgBurn : null

  const topRevenueMtd = [...mtdPnL.revenue].sort((a, b) => b.amount - a.amount).slice(0, 5)
  const topExpensesMtd = [...mtdPnL.expenses].sort((a, b) => b.amount - a.amount).slice(0, 5)

  return {
    asOf: today,
    cashPosition,
    arOutstanding,
    apOutstanding,
    vatPayable,
    payeAndSsnitPayable,
    currentAssets,
    currentLiabilities,
    totalAssets,
    totalLiabilities,
    totalEquity,
    ratios,
    mtd: {
      revenue: mtdPnL.totalRevenue,
      expenses: mtdPnL.totalExpenses,
      netProfit: mtdPnL.netProfit,
      bookingRevenue: bookingFinance.mtd_recognized,
      otherRevenue: mtdPnL.totalRevenue - bookingFinance.mtd_recognized,
    },
    ytd: {
      revenue: ytdPnL.totalRevenue,
      expenses: ytdPnL.totalExpenses,
      netProfit: ytdPnL.netProfit,
      bookingRevenue: bookingFinance.ytd_recognized,
      otherRevenue: ytdPnL.totalRevenue - bookingFinance.ytd_recognized,
    },
    cashRunwayMonths,
    monthlyTrend,
    topRevenueMtd,
    topExpensesMtd,
    integrity: {
      paymentJournalGaps:         Number(integrityRow.payment_journal_gaps ?? 0),
      chargeJournalGaps:          Number(integrityRow.charge_journal_gaps ?? 0),
      depositJournalGaps:         Number(integrityRow.deposit_journal_gaps ?? 0),
      unbalancedJournals:         Number(integrityRow.unbalanced_journals ?? 0),
      crossTenantJournalLines:    Number(integrityRow.cross_tenant_journal_lines ?? 0),
      bookingBalanceMismatches:   Number(integrityRow.booking_balance_mismatches ?? 0),
      cancelledRevenueExposure:  Number(integrityRow.cancelled_revenue_exposure ?? 0),
      depositLiabilityMismatches: Number(integrityRow.deposit_liability_mismatches ?? 0),
      totalIssues:                Number(integrityRow.total_issues ?? 0),
    },
  }
}

export async function getAccountingKpis() {
  const now    = new Date()
  const y      = now.getFullYear()
  const m      = String(now.getMonth() + 1).padStart(2, '0')
  const mtdStart = `${y}-${m}-01`
  const ytdStart = `${y}-01-01`
  const today  = now.toISOString().slice(0, 10)

  const [mtdPnL, ytdPnL] = await Promise.all([
    getPnL(mtdStart, today),
    getPnL(ytdStart, today),
  ])

  return {
    mtdRevenue: mtdPnL.totalRevenue,
    mtdExpenses: mtdPnL.totalExpenses,
    mtdProfit: mtdPnL.netProfit,
    ytdRevenue: ytdPnL.totalRevenue,
    ytdExpenses: ytdPnL.totalExpenses,
    ytdProfit: ytdPnL.netProfit,
  }
}
