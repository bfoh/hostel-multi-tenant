import { createAdminClient } from '@/lib/supabase/admin'

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
  const supabase = createAdminClient()
  const { data } = await (supabase as any)
    .from('chart_of_accounts')
    .select('id, code, name, type, is_system, is_active, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  return (data ?? []) as Account[]
}

/* ── Journal entries ──────────────────────────────────────────────────── */

export async function getJournalEntries(limit = 50, offset = 0): Promise<JournalEntry[]> {
  const supabase = createAdminClient()
  const { data } = await (supabase as any)
    .from('journal_entries')
    .select(`
      id, entry_date, reference, description, source, source_id, created_at,
      lines:journal_lines(
        id, description, debit, credit,
        account:chart_of_accounts(code, name, type)
      )
    `)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

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
  const supabase = createAdminClient()

  // Fetch all journal lines (optionally filtered by entry date)
  let q = (supabase as any)
    .from('journal_lines')
    .select(`
      account_id, debit, credit,
      entry:journal_entries!inner(entry_date),
      account:chart_of_accounts(code, name, type)
    `)

  if (dateFrom) q = q.gte('journal_entries.entry_date', dateFrom)
  if (dateTo)   q = q.lte('journal_entries.entry_date', dateTo)

  const { data } = await q

  // Aggregate by account
  const map = new Map<string, TrialBalanceLine>()

  for (const line of (data ?? []) as any[]) {
    const acct = Array.isArray(line.account) ? line.account[0] : line.account
    if (!acct) continue
    const key = line.account_id as string
    if (!map.has(key)) {
      map.set(key, {
        account_id: key,
        code: acct.code,
        name: acct.name,
        type: acct.type,
        total_debit: 0,
        total_credit: 0,
        balance: 0,
      })
    }
    const entry = map.get(key)!
    entry.total_debit  += line.debit as number
    entry.total_credit += line.credit as number
  }

  // Compute normal balance
  for (const entry of map.values()) {
    const debitNormal = entry.type === 'asset' || entry.type === 'expense'
    entry.balance = debitNormal
      ? entry.total_debit - entry.total_credit
      : entry.total_credit - entry.total_debit
  }

  return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code))
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
  const equity      = tb.filter((a) => a.type === 'equity')

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
 * Direct-method cash flow built from journal lines that touch the Cash account (1020).
 * Debits to cash = inflows; credits to cash = outflows.
 * Groups by journal entry source for a meaningful breakdown.
 */
export async function getCashFlow(dateFrom: string, dateTo: string): Promise<CashFlowReport> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('journal_lines')
    .select(`
      debit, credit,
      entry:journal_entries!inner(source, entry_date),
      account:chart_of_accounts!inner(code)
    `)
    .gte('journal_entries.entry_date', dateFrom)
    .lte('journal_entries.entry_date', dateTo)

  // Only lines hitting the Cash account (code starts with 1020)
  const cashLines = (data ?? []).filter((l: any) => {
    const acct = Array.isArray(l.account) ? l.account[0] : l.account
    return acct?.code?.startsWith('1020')
  })

  // Aggregate inflows / outflows by source
  const sourceMap = new Map<string, { in: number; out: number }>()
  for (const line of cashLines as any[]) {
    const entry  = Array.isArray(line.entry) ? line.entry[0] : line.entry
    const src    = entry?.source ?? 'other'
    if (!sourceMap.has(src)) sourceMap.set(src, { in: 0, out: 0 })
    const s = sourceMap.get(src)!
    s.in  += line.debit
    s.out += line.credit
  }

  const SOURCE_LABELS: Record<string, string> = {
    booking_payment:     'Room payment receipts',
    payroll:             'Staff payroll payments',
    expense:             'Operating expense payments',
    refund:              'Refunds paid',
    bank_reconciliation: 'Bank reconciliation adjustments',
    manual:              'Manual entries',
  }

  const operating: CashFlowReport['operating'] = []

  for (const [src, { in: inflow, out: outflow }] of sourceMap.entries()) {
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
