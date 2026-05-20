import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'

export interface DepreciableAsset {
  id:                      string
  name:                    string
  category:                string
  purchase_date:           string | null
  purchase_price:          number | null
  salvage_value:           number
  useful_life_months:      number | null
  depreciation_start_date: string | null
  last_depreciated_through:string | null
  accumulated_depreciation:number
  status:                  string
  monthlyDepreciation:     number   // computed
  netBookValue:            number   // cost - acc dep
  isFullyDepreciated:      boolean
}

export interface DepreciationRun {
  id:               string
  period_year:      number
  period_month:     number
  asset_count:      number
  total_amount:     number
  journal_entry_id: string | null
  posted_at:        string
}

export interface DepreciationOverview {
  totalCost:                 number
  totalAccumulated:          number
  totalNetBookValue:         number
  activeAssetCount:          number
  configuredAssetCount:      number
  unconfiguredAssetCount:    number
  thisMonthEstimate:         number
  assets:                    DepreciableAsset[]
  recentRuns:                DepreciationRun[]
  lastRunPeriod:             { year: number; month: number } | null
  nextEligiblePeriod:        { year: number; month: number }
}

export function computeMonthlyDepreciation(a: {
  purchase_price:     number | null
  salvage_value:      number
  useful_life_months: number | null
}): number {
  if (!a.purchase_price || !a.useful_life_months || a.useful_life_months <= 0) return 0
  const base = Math.max(0, a.purchase_price - a.salvage_value)
  return Math.round(base / a.useful_life_months)
}

export async function getDepreciationOverview(): Promise<DepreciationOverview | null> {
  const tenantId = await getServerTenantId()
  if (!tenantId) return null

  const supabase = createAdminClient()

  const [{ data: assetsRaw }, { data: runsRaw }] = await Promise.all([
    (supabase as any)
      .from('assets')
      .select(`
        id, name, category, status,
        purchase_date, purchase_price,
        salvage_value, useful_life_months,
        depreciation_method, depreciation_start_date,
        last_depreciated_through, accumulated_depreciation
      `)
      .eq('tenant_id', tenantId)
      .neq('status', 'disposed')
      .order('name'),
    (supabase as any)
      .from('depreciation_runs')
      .select('id, period_year, period_month, asset_count, total_amount, journal_entry_id, posted_at')
      .eq('tenant_id', tenantId)
      .order('period_year',  { ascending: false })
      .order('period_month', { ascending: false })
      .limit(12),
  ])

  const assets: DepreciableAsset[] = ((assetsRaw ?? []) as any[]).map((a) => {
    const monthly = computeMonthlyDepreciation({
      purchase_price:     a.purchase_price,
      salvage_value:      a.salvage_value,
      useful_life_months: a.useful_life_months,
    })
    const cost      = a.purchase_price ?? 0
    const netBook   = Math.max(0, cost - a.accumulated_depreciation)
    const fully     = cost > 0 && netBook <= a.salvage_value
    return {
      id:                       a.id,
      name:                     a.name,
      category:                 a.category,
      purchase_date:            a.purchase_date,
      purchase_price:           a.purchase_price,
      salvage_value:            a.salvage_value,
      useful_life_months:       a.useful_life_months,
      depreciation_start_date:  a.depreciation_start_date,
      last_depreciated_through: a.last_depreciated_through,
      accumulated_depreciation: a.accumulated_depreciation,
      status:                   a.status,
      monthlyDepreciation:      fully ? 0 : monthly,
      netBookValue:             netBook,
      isFullyDepreciated:       fully,
    }
  })

  const configured   = assets.filter((a) => a.monthlyDepreciation > 0 || a.isFullyDepreciated)
  const unconfigured = assets.filter((a) => a.purchase_price && (a.useful_life_months ?? 0) <= 0)

  const totalCost          = assets.reduce((s, a) => s + (a.purchase_price ?? 0), 0)
  const totalAccumulated   = assets.reduce((s, a) => s + a.accumulated_depreciation, 0)
  const totalNetBookValue  = Math.max(0, totalCost - totalAccumulated)
  const thisMonthEstimate  = assets.reduce((s, a) => s + a.monthlyDepreciation, 0)

  const recentRuns: DepreciationRun[] = (runsRaw ?? []) as any[]
  const lastRun = recentRuns[0] ?? null

  const now = new Date()
  let nextYear  = now.getFullYear()
  let nextMonth = now.getMonth() + 1
  if (lastRun) {
    // Next period = the month after the last run
    const d = new Date(lastRun.period_year, lastRun.period_month, 1) // already month after
    nextYear  = d.getFullYear()
    nextMonth = d.getMonth() + 1
  }

  return {
    totalCost,
    totalAccumulated,
    totalNetBookValue,
    activeAssetCount:       assets.length,
    configuredAssetCount:   configured.length,
    unconfiguredAssetCount: unconfigured.length,
    thisMonthEstimate,
    assets,
    recentRuns,
    lastRunPeriod: lastRun ? { year: lastRun.period_year, month: lastRun.period_month } : null,
    nextEligiblePeriod: { year: nextYear, month: nextMonth },
  }
}
