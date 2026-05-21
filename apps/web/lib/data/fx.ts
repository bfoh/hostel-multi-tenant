import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'

// Re-export from the client-safe module so existing server imports keep working
export { COMMON_FOREIGN_CURRENCIES } from '@/lib/currencies'

export interface FxRate {
  id:            string
  currency_code: string
  rate_to_base:  number
  as_of_date:    string
  source:        string | null
  notes:         string | null
  created_at:    string
}

export async function getFxRates(limit = 200): Promise<FxRate[]> {
  const tenantId = await getServerTenantId()
  if (!tenantId) return []

  const supabase = createAdminClient()
  const { data } = await (supabase as any)
    .from('fx_rates')
    .select('id, currency_code, rate_to_base, as_of_date, source, notes, created_at')
    .eq('tenant_id', tenantId)
    .order('as_of_date',   { ascending: false })
    .order('currency_code',{ ascending: true })
    .limit(limit)

  return ((data ?? []) as any[]).map((r) => ({
    ...r,
    rate_to_base: Number(r.rate_to_base),
  })) as FxRate[]
}

/** Latest rate per currency, sorted alphabetically. */
export async function getLatestFxRates(): Promise<FxRate[]> {
  const rates = await getFxRates(500)
  const seen = new Set<string>()
  const latest: FxRate[] = []
  for (const r of rates) {
    if (seen.has(r.currency_code)) continue
    seen.add(r.currency_code)
    latest.push(r)
  }
  return latest.sort((a, b) => a.currency_code.localeCompare(b.currency_code))
}
