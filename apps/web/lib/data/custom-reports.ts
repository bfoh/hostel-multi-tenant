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
}

export interface ReportResult {
  period:    { from: string; to: string; label: string }
  rows:      ReportResultRow[]
  total:     number
  groupedBy: 'by_account' | 'by_type'
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

export async function runCustomReport(definition: ReportDefinition): Promise<ReportResult | null> {
  const tenantId = await getServerTenantId()
  if (!tenantId) return null

  const period = resolvePeriod(definition.period)
  const tb     = await getTrialBalance(period.from, period.to)

  const typeSet = new Set(definition.accountTypes)
  const idSet   = definition.accountIds && definition.accountIds.length > 0
    ? new Set(definition.accountIds)
    : null

  const filtered = tb.filter((l) => {
    if (!typeSet.has(l.type)) return false
    if (idSet && !idSet.has(l.account_id)) return false
    return true
  })

  let rows: ReportResultRow[]
  if (definition.grouping === 'by_type') {
    const map = new Map<AccountType, number>()
    for (const l of filtered) map.set(l.type, (map.get(l.type) ?? 0) + l.balance)
    rows = Array.from(map.entries()).map(([type, amount]) => ({
      name: `${type[0].toUpperCase()}${type.slice(1)} total`,
      type,
      amount,
    }))
  } else {
    rows = filtered.map((l) => ({
      account_id: l.account_id,
      code:       l.code,
      name:       l.name,
      type:       l.type,
      amount:     l.balance,
    }))
  }

  const total = rows.reduce((s, r) => s + r.amount, 0)

  return { period, rows, total, groupedBy: definition.grouping }
}
