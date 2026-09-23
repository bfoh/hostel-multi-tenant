import { createAdminClient } from '@/lib/supabase/admin'
import type { BusinessType } from '@/lib/tenant/host-classification'

export interface DirectoryListing {
  slug:           string
  name:           string
  tagline:        string | null
  logo_url:       string | null
  primary_color:  string | null
  address_city:   string | null
  address_region: string | null
  business_type:  BusinessType
  from_rate:      number
  category_count: number
  /** First photo found across this tenant's active room categories — an
   *  owner-uploaded room photo, not a stock image or the tenant's logo. */
  hero_image_url: string | null
  created_at:     string
}

export interface DirectorySearchParams {
  /** Which vertical to search — every caller is a specific vertical's
   *  marketplace page, so this is required rather than defaulting. */
  businessType: BusinessType
  city?:   string | null
  region?: string | null
  q?:      string | null
  page?:   number
  limit?:  number
  sort?:   'name' | 'price_asc' | 'price_desc' | 'newest'
}

/**
 * Public, cross-tenant listing search shared by /api/public/directory, the
 * /browse directory page, and the homepage's "Featured" section — one query
 * implementation instead of three, and pages call it directly server-side
 * rather than self-fetching their own API route. Serves both verticals
 * (hostel/hotel) via the same tenants/room_categories tables, filtered by
 * business_type.
 *
 * Visibility: listed_publicly = true and status in
 * ('trial','active','trial_expired') — i.e. tenant.is_active (migration
 * 119). A trial_expired tenant's listing stays live on purpose. Also
 * requires at least one active room_categories row.
 */
export async function searchListings(
  params: DirectorySearchParams,
): Promise<{ listings: DirectoryListing[]; total: number }> {
  const { businessType, city, region, q, page = 1, limit = 20, sort = 'name' } = params
  const offset = (Math.max(1, page) - 1) * limit

  const supabase = createAdminClient()

  // The inner join fans out one row per matching category, so paginating
  // this query directly would paginate over categories, not tenants. Fetch
  // a generous flat batch instead, group into distinct tenants in JS, then
  // paginate the grouped result — correct at the realistic scale of a
  // regional directory, without needing a materialized view.
  let query = supabase
    .from('tenants')
    .select('id, slug, name, tagline, logo_url, primary_color, address_city, address_region, business_type, created_at, room_categories!inner(base_rate, is_active, image_urls, sort_order)')
    .eq('listed_publicly', true)
    .eq('business_type', businessType)
    .in('status', ['trial', 'active', 'trial_expired'])
    .eq('room_categories.is_active', true)

  if (city)   query = query.ilike('address_city', `%${city}%`)
  if (region) query = query.eq('address_region', region)
  if (q)      query = query.ilike('name', `%${q}%`)

  const { data, error } = await query.order('name').limit(1000)
  if (error) throw new Error(error.message)

  const byTenant = new Map<string, DirectoryListing>()

  for (const row of (data ?? []) as any[]) {
    const categories = (Array.isArray(row.room_categories) ? row.room_categories : [row.room_categories])
      .filter((c: any) => c?.is_active)
      .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    if (categories.length === 0) continue

    const activeRates = categories.map((c: any) => c.base_rate as number)
    const firstPhoto = categories.map((c: any) => (c.image_urls ?? [])[0]).find(Boolean) ?? null

    const existing = byTenant.get(row.id)
    const minRate = Math.min(...activeRates)
    if (existing) {
      existing.from_rate = Math.min(existing.from_rate, minRate)
      existing.category_count += activeRates.length
      if (!existing.hero_image_url && firstPhoto) existing.hero_image_url = firstPhoto
    } else {
      byTenant.set(row.id, {
        slug: row.slug, name: row.name, tagline: row.tagline, logo_url: row.logo_url,
        primary_color: row.primary_color, address_city: row.address_city, address_region: row.address_region,
        business_type: row.business_type,
        from_rate: minRate, category_count: activeRates.length, hero_image_url: firstPhoto,
        created_at: row.created_at,
      })
    }
  }

  let all = Array.from(byTenant.values())
  if (sort === 'price_asc')  all = all.sort((a, b) => a.from_rate - b.from_rate)
  if (sort === 'price_desc') all = all.sort((a, b) => b.from_rate - a.from_rate)
  if (sort === 'newest')     all = all.sort((a, b) => b.created_at.localeCompare(a.created_at))
  // 'name' is already the DB sort order

  return { listings: all.slice(offset, offset + limit), total: all.length }
}
