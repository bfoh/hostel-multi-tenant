import { createAdminClient } from '@/lib/supabase/admin'

export interface DirectoryHostel {
  slug:           string
  name:           string
  tagline:        string | null
  logo_url:       string | null
  primary_color:  string | null
  address_city:   string | null
  address_region: string | null
  from_rate:      number
  category_count: number
}

export interface DirectorySearchParams {
  city?:   string | null
  region?: string | null
  q?:      string | null
  page?:   number
  limit?:  number
}

/**
 * Public, cross-tenant hostel search shared by /api/public/directory, the
 * /hostels directory page, and the homepage's "Featured hostels" section —
 * one query implementation instead of three, and pages call it directly
 * server-side rather than self-fetching their own API route.
 *
 * Visibility: listed_publicly = true and status in
 * ('trial','active','trial_expired') — i.e. tenant.is_active (migration
 * 119). A trial_expired tenant's listing stays live on purpose. Also
 * requires at least one active room_categories row.
 */
export async function searchHostels(
  params: DirectorySearchParams = {},
): Promise<{ hostels: DirectoryHostel[]; total: number }> {
  const { city, region, q, page = 1, limit = 20 } = params
  const offset = (Math.max(1, page) - 1) * limit

  const supabase = createAdminClient()

  // The inner join fans out one row per matching category, so paginating
  // this query directly would paginate over categories, not tenants. Fetch
  // a generous flat batch instead, group into distinct tenants in JS, then
  // paginate the grouped result — correct at the realistic scale of a
  // regional hostel directory, without needing a materialized view.
  let query = supabase
    .from('tenants')
    .select('id, slug, name, tagline, logo_url, primary_color, address_city, address_region, room_categories!inner(base_rate, is_active)')
    .eq('listed_publicly', true)
    .in('status', ['trial', 'active', 'trial_expired'])
    .eq('room_categories.is_active', true)

  if (city)   query = query.ilike('address_city', `%${city}%`)
  if (region) query = query.eq('address_region', region)
  if (q)      query = query.ilike('name', `%${q}%`)

  const { data, error } = await query.order('name').limit(1000)
  if (error) throw new Error(error.message)

  const byTenant = new Map<string, DirectoryHostel>()

  for (const row of (data ?? []) as any[]) {
    const categories = Array.isArray(row.room_categories) ? row.room_categories : [row.room_categories]
    const activeRates = categories.filter((c: any) => c?.is_active).map((c: any) => c.base_rate as number)
    if (activeRates.length === 0) continue

    const existing = byTenant.get(row.id)
    const minRate = Math.min(...activeRates)
    if (existing) {
      existing.from_rate = Math.min(existing.from_rate, minRate)
      existing.category_count += activeRates.length
    } else {
      byTenant.set(row.id, {
        slug: row.slug, name: row.name, tagline: row.tagline, logo_url: row.logo_url,
        primary_color: row.primary_color, address_city: row.address_city, address_region: row.address_region,
        from_rate: minRate, category_count: activeRates.length,
      })
    }
  }

  const all = Array.from(byTenant.values())
  return { hostels: all.slice(offset, offset + limit), total: all.length }
}
