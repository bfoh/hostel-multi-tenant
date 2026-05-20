import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { getTrialBalance, type AccountType } from '@/lib/data/accounting'

export interface ReportDefinition {
  accountTypes:    AccountType[]           // e.g. ['revenue', 'expense']
  accountIds?:     string[]                // empty/undefined = all of the chosen types
  period: {
    kind:          'mtd' | 'qtd' | 'ytd' | 'last_month' | 'last_year' | 'custom'
    from?:         string  // YYYY-MM-DD (when kind = 'custom')
    to?:           string
  }
  grouping:        'by_account' | 'by_type'
  comparison?:     'none' | 'prior_period' | 'prior_year'
}

export interface CustomReport {
  id:          string
  name:        string
  description: string | null
  definition:  ReportDefinition
  created_at:  string
  updated_at:  string
}

export interface ReportResultRow {
  account_id?:  string
  code?:        string
  name:         string
  type:         AccountType
  amount:       number
  priorAmount?: number   // present when comparison set
  delta?:       number   // amount - priorAmount
  deltaPct?:    number | null
}

export interface ReportResult {
  period:        { from: string; to: string; label: string }
  priorPeriod?:  { from: string; to: string; label: string }
  rows:          ReportResultRow[]
  total:         number
  priorTotal?:   number
  groupedBy:     'by_account' | 'by_type'
}

export async function getCustomReports(): Promise<CustomReport[]> {
  const tenantId = await getServerTenantId()
  if (!tenantId) return []

  const supabase = createAdminClient()
  const { data } = await (supabase as any)
    .from('custom_reports')
    .select('id, name, description, definition, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false })
    .limit(100)
  return (data ?? []) as CustomReport[]
}

export async function getCustomReportById(id: string): Promise<CustomReport | null> {
  const tenantId = await getServerTenantId()
  if (!tenantId) return null

  const supabase = createAdminClient()
  const { data } = await (supabase as any)
    .from('custom_reports')
    .select('id, name, description, definition, created_at, updated_at')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  return data as CustomReport | null
}

function resolvePeriod(def: ReportDefinition['period']): { from: string; to: string; label: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  switch (def.kind) {
    case 'mtd':
      return { from: fmt(new Date(y, m, 1)), to: fmt(now), label: 'Month to date' }
    case 'qtd':
      return { from: fmt(new Date(y, Math.floor(m / 3) * 3, 1)), to: fmt(now), label: 'Quarter to date' }
    case 'ytd':
      return { from: fmt(new Date(y, 0, 1)), to: fmt(now), label: 'Year to date' }
    case 'last_month': {
      const start = new Date(y, m - 1, 1)
      const end   = new Date(y, m, 0)
      return { from: fmt(start), to: fmt(end), label: 'Last month' }
    }
    case 'last_year': {
      const start = new Date(y - 1, 0, 1)
      const end   = new Date(y - 1, 11, 31)
      return { from: fmt(start), to: fmt(end), label: `${y - 1} full year` }
    }
    case 'custom':
      return {
        from:  def.from ?? fmt(new Date(y, m, 1)),
        to:    def.to   ?? fmt(now),
        label: `${def.from} → ${def.to}`,
      }
  }
}

/**
 * Returns the comparable prior window. For prior_period the window length
 * matches the current one and ends the day before it starts. For prior_year
 * the same calendar window shifts back 12 months.
 */
function priorWindow(
  current: { from: string; to: string },
  kind:    'prior_period' | 'prior_year',
): { from: string; to: string; label: string } {
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const fromDate = new Date(current.from)
  const toDate   = new Date(current.to)

  if (kind === 'prior_year') {
    const start = new Date(fromDate)
    const end   = new Date(toDate)
    start.setFullYear(start.getFullYear() - 1)
    end.setFullYear(end.getFullYear() - 1)
    return { from: fmt(start), to: fmt(end), label: 'Prior year — same window' }
  }

  // prior_period — equal length ending the day before current.from
  const dayMs   = 24 * 60 * 60 * 1000
  const lengthMs = toDate.getTime() - fromDate.getTime()
  const priorEnd   = new Date(fromDate.getTime() - dayMs)
  const priorStart = new Date(priorEnd.getTime() - lengthMs)
  return { from: fmt(priorStart), to: fmt(priorEnd), label: 'Prior period — same length' }
}

export async function runCustomReport(definition: ReportDefinition): Promise<ReportResult | null> {
  const tenantId = await getServerTenantId()
  if (!tenantId) return null

  const period       = resolvePeriod(definition.period)
  const comparison   = definition.comparison ?? 'none'
  const priorPeriod  = comparison !== 'none' ? priorWindow(period, comparison) : undefined

  const typeSet = new Set(definition.accountTypes)
  const idSet   = definition.accountIds && definition.accountIds.length > 0
    ? new Set(definition.accountIds)
    : null

  const matches = (l: { type: AccountType; account_id: string }) => {
    if (!typeSet.has(l.type)) return false
    if (idSet && !idSet.has(l.account_id)) return false
    return true
  }

  const [tb, tbPrior] = await Promise.all([
    getTrialBalance(period.from, period.to),
    priorPeriod ? getTrialBalance(priorPeriod.from, priorPeriod.to) : Promise.resolve([]),
  ])

  const filtered      = tb.filter(matches)
  const filteredPrior = tbPrior.filter(matches)

  // Build prior lookup keyed by account_id (only meaningful for by_account); for
  // by_type we'll aggregate prior into a per-type map below.
  const priorByAccount = new Map(filteredPrior.map((l) => [l.account_id, l.balance]))
  const priorByType    = new Map<AccountType, number>()
  for (const l of filteredPrior) priorByType.set(l.type, (priorByType.get(l.type) ?? 0) + l.balance)

  const withComparison = (amount: number, prior: number | undefined): Partial<ReportResultRow> => {
    if (!priorPeriod) return {}
    const priorAmount = prior ?? 0
    const delta = amount - priorAmount
    const deltaPct = priorAmount !== 0 ? (delta / priorAmount) * 100 : null
    return { priorAmount, delta, deltaPct }
  }

  let rows: ReportResultRow[]
  if (definition.grouping === 'by_type') {
    const map = new Map<AccountType, number>()
    for (const l of filtered) map.set(l.type, (map.get(l.type) ?? 0) + l.balance)
    rows = Array.from(map.entries()).map(([type, amount]) => ({
      name: `${type[0].toUpperCase()}${type.slice(1)} total`,
      type,
      amount,
      ...withComparison(amount, priorByType.get(type)),
    }))
  } else {
    rows = filtered.map((l) => ({
      account_id: l.account_id,
      code:       l.code,
      name:       l.name,
      type:       l.type,
      amount:     l.balance,
      ...withComparison(l.balance, priorByAccount.get(l.account_id)),
    }))
  }

  const total      = rows.reduce((s, r) => s + r.amount, 0)
  const priorTotal = priorPeriod ? filteredPrior.reduce((s, r) => s + r.balance, 0) : undefined

  return { period, priorPeriod, rows, total, priorTotal, groupedBy: definition.grouping }
}
