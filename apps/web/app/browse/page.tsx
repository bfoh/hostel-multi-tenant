import type { Metadata } from 'next'
import Link from 'next/link'
import { Search, MapPin, LayoutGrid, List as ListIcon, ChevronRight, SearchX, BedDouble, Building2, Home } from 'lucide-react'
import { searchListings, type MarketplaceVertical } from '@/lib/directory'
import { ListingCard } from '@/components/public/listing-card'
import { ListingListRow } from '@/components/public/listing-list-row'
import { ListingSortSelect } from '@/components/public/listing-sort-select'
import { FiltersDisclosure } from '@/components/public/filters-disclosure'
import { MarketplaceNav } from '@/components/marketplace/marketplace-nav'
import { MarketplaceFooter } from '@/components/marketplace/marketplace-footer'
import { MP } from '@/lib/marketplace-theme'
import { displayPlace } from '@/lib/listing-display'

const VERTICALS = [
  { type: 'hostel', label: 'Hostels', icon: BedDouble },
  { type: 'hotel', label: 'Hotels', icon: Building2 },
  { type: 'apartment', label: 'Apartments', icon: Home },
] as const

const GHANA_REGIONS = [
  'Ahafo', 'Ashanti', 'Bono', 'Bono East', 'Central', 'Eastern',
  'Greater Accra', 'North East', 'Northern', 'Oti', 'Savannah',
  'Upper East', 'Upper West', 'Volta', 'Western', 'Western North',
]

export const metadata: Metadata = {
  title: { absolute: 'Find a Stay — Beddilo' },
  description: 'Search hotels, student hostels and apartments — real-time availability, booked directly with the property.',
}

function buildQuery(sp: Record<string, string | undefined>, overrides: Record<string, string | undefined>) {
  const merged = { ...sp, ...overrides }
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(merged)) {
    if (v) qs.set(k, v)
  }
  const query = qs.toString()
  return query ? `?${query}` : ''
}

export default async function BrowseDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; city?: string; region?: string; q?: string; page?: string; sort?: string; view?: string; min?: string; max?: string }>
}) {
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const sort = (['name', 'price_asc', 'price_desc'].includes(sp.sort ?? '') ? sp.sort : 'name') as 'name' | 'price_asc' | 'price_desc'
  const view = sp.view === 'grid' ? 'grid' : 'list'

  // Vertical comes from the hero search's tab (?type=hostel|hotel|apartment).
  const businessType: MarketplaceVertical =
    sp.type === 'hotel' ? 'hotel' : sp.type === 'apartment' ? 'apartment' : 'hostel'
  const nounSingular = businessType === 'hotel' ? 'hotel' : businessType === 'apartment' ? 'apartment' : 'hostel'
  const nounPlural = businessType === 'hotel' ? 'Hotels' : businessType === 'apartment' ? 'Apartments' : 'Hostels'

  const { listings: allResults } = await searchListings({
    businessType, city: sp.city, region: sp.region, q: sp.q, sort, limit: 1000,
  })

  const min = sp.min ? Number(sp.min) : null
  const max = sp.max ? Number(sp.max) : null
  const filtered = allResults.filter((h) => (min == null || h.from_rate >= min * 100) && (max == null || h.from_rate <= max * 100))

  const pageSize = 20
  const pageStart = (page - 1) * pageSize
  const hostels = filtered.slice(pageStart, pageStart + pageSize)
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))

  const activeFilters = [sp.min, sp.max, sp.region].filter(Boolean).length
  const place = sp.region || displayPlace(sp.city)
  const hasSearch = !!(sp.q || sp.city || sp.region || sp.min || sp.max)
  // Switching type keeps where the visitor is looking, but not a property
  // name or price range that belonged to the other type.
  const verticalHref = (type: string) =>
    `/browse${buildQuery({ city: sp.city, region: sp.region, view: sp.view, sort: sp.sort }, { type: type === 'hostel' ? undefined : type })}`

  const priceBounds = allResults.length > 0
    ? { lo: Math.min(...allResults.map((h) => h.from_rate)) / 100, hi: Math.max(...allResults.map((h) => h.from_rate)) / 100 }
    : { lo: 0, hi: 0 }

  return (
    <div className="relative min-h-screen" style={{ background: MP.bg }}>

      <MarketplaceNav />

      {/* ── Search bar + stay type ──────────────────────────────── */}
      <div className="border-b pt-4 sm:pt-6" style={{ background: MP.surfaceSoft, borderColor: MP.border }}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <form action="/browse" method="get" role="search" aria-label={`Search ${nounPlural.toLowerCase()}`} className="grid gap-2 rounded-xl border bg-white p-2 shadow-[0_8px_24px_-16px_rgba(18,36,41,0.3)] sm:grid-cols-[1.3fr_1fr_auto_auto]" style={{ borderColor: MP.border }}>
            {sp.type && <input type="hidden" name="type" value={sp.type} />}
            {sp.view && <input type="hidden" name="view" value={sp.view} />}
            <label className="flex min-h-[48px] items-center gap-2.5 rounded-lg px-3 focus-within:bg-bd-mist">
              <Search className="h-[18px] w-[18px] shrink-0" style={{ color: MP.textSecondary }} aria-hidden="true" />
              <span className="sr-only">{businessType === 'hostel' ? 'Hostel name' : 'Property name'}</span>
              <input
                name="q"
                defaultValue={sp.q ?? ''}
                enterKeyHint="search"
                placeholder={
                  businessType === 'hotel' ? 'Hotel or guesthouse name' :
                  businessType === 'apartment' ? 'Apartment or short-let name' :
                  'Hostel name'
                }
                className="w-full bg-transparent text-[16px] outline-none placeholder:text-bd-slate sm:text-[15px]"
                style={{ color: MP.ink }}
              />
            </label>
            <label className="flex min-h-[48px] items-center gap-2.5 rounded-lg border-t px-3 focus-within:bg-bd-mist sm:rounded-none sm:border-l sm:border-t-0" style={{ borderColor: MP.border }}>
              <MapPin className="h-[18px] w-[18px] shrink-0" style={{ color: MP.textSecondary }} aria-hidden="true" />
              <span className="sr-only">City or town</span>
              <input
                name="city"
                defaultValue={sp.city ?? ''}
                enterKeyHint="search"
                autoComplete="address-level2"
                placeholder="City or town"
                className="w-full bg-transparent text-[16px] outline-none placeholder:text-bd-slate sm:text-[15px]"
                style={{ color: MP.ink }}
              />
            </label>
            <select
              name="region" defaultValue={sp.region ?? ''}
              aria-label="Region"
              className="bd-focus min-h-[48px] cursor-pointer rounded-lg border bg-white px-3 text-[16px] sm:w-44 sm:text-[15px]"
              style={{ color: MP.ink, borderColor: MP.border }}
            >
              <option value="">All regions</option>
              {GHANA_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <button
              type="submit"
              className="bd-focus inline-flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-lg px-6 text-[15px] font-semibold text-white transition-colors duration-200 hover:bg-bd-teal-900"
              style={{ background: MP.primary }}
            >
              <Search className="h-4 w-4" aria-hidden="true" /> Search
            </button>
          </form>

          <nav aria-label="Type of stay" className="mt-2 sm:mt-3">
            <ul className="flex gap-1 sm:gap-4">
              {VERTICALS.map(({ type, label, icon: Icon }) => {
                const current = type === businessType
                return (
                  <li key={type} className="flex-1 sm:flex-none">
                    <Link
                      href={verticalHref(type)}
                      aria-current={current ? 'page' : undefined}
                      className={`bd-focus -mb-px flex min-h-[48px] items-center justify-center gap-2 whitespace-nowrap border-b-2 px-2 text-[14px] font-semibold transition-colors sm:px-1 ${
                        current ? 'border-bd-teal text-bd-ink' : 'border-transparent text-bd-slate hover:border-bd-ink/20 hover:text-bd-ink'
                      }`}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={current ? 2.1 : 1.8} aria-hidden="true" />
                      {label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
        </div>
      </div>

      {/* ── Breadcrumb ─────────────────────────────────────────── */}
      <nav aria-label="Breadcrumb" className="mx-auto max-w-6xl px-4 py-3 text-[13px] sm:px-6" style={{ color: MP.textSecondary }}>
        <Link href="/" className="underline underline-offset-2" style={{ color: MP.primary }}>Home</Link>
        <span className="mx-1.5">›</span>
        {sp.region ? (
          <>
            <Link href={verticalHref(businessType)} className="underline underline-offset-2" style={{ color: MP.primary }}>
              {nounPlural}
            </Link>
            <span className="mx-1.5">›</span>
            <span>{sp.region}</span>
          </>
        ) : (
          <span>{nounPlural}</span>
        )}
      </nav>

      <div className="mx-auto max-w-6xl gap-6 px-4 pb-16 sm:px-6 lg:flex">
        {/* ── Filters sidebar ─────────────────────────────────── */}
        <aside className="mb-4 w-full shrink-0 lg:mb-0 lg:w-64">
          <FiltersDisclosure activeCount={activeFilters}>
          <div className="rounded-xl bg-white p-4 lg:p-5" style={{ border: `1px solid ${MP.border}` }}>
            <h2 className="text-[16px] font-semibold" style={{ color: MP.ink }}>Filters</h2>

            <form action="/browse" method="get" className="mt-4 space-y-5">
              {sp.type && <input type="hidden" name="type" value={sp.type} />}
              {sp.q && <input type="hidden" name="q" value={sp.q} />}
              {sp.city && <input type="hidden" name="city" value={sp.city} />}
              {sp.region && <input type="hidden" name="region" value={sp.region} />}

              <div>
                <p className="text-[13px] font-semibold" style={{ color: MP.ink }}>Starting price (GH₵)</p>
                {allResults.length > 0 && (
                  <p className="mt-0.5 text-[12px]" style={{ color: MP.textSecondary }}>
                    GH₵{priceBounds.lo.toFixed(0)} – GH₵{priceBounds.hi.toFixed(0)}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <input
                    name="min" type="number" inputMode="numeric" min={0} defaultValue={sp.min ?? ''} placeholder="Min" aria-label="Minimum starting price in GH₵"
                    className="bd-focus min-h-[40px] w-full rounded-lg border px-2.5 text-[16px] lg:text-[14px]"
                    style={{ borderColor: MP.border, color: MP.ink }}
                  />
                  <span style={{ color: MP.textSecondary }}>–</span>
                  <input
                    name="max" type="number" inputMode="numeric" min={0} defaultValue={sp.max ?? ''} placeholder="Max" aria-label="Maximum starting price in GH₵"
                    className="bd-focus min-h-[40px] w-full rounded-lg border px-2.5 text-[16px] lg:text-[14px]"
                    style={{ borderColor: MP.border, color: MP.ink }}
                  />
                </div>
                <button
                  type="submit"
                  className="bd-focus mt-2.5 min-h-[40px] w-full rounded-lg border text-[14px] font-semibold transition-colors hover:bg-bd-mist"
                  style={{ color: MP.primary, borderColor: MP.borderStrong }}
                >
                  Apply price
                </button>
              </div>
            </form>

            <details className="mt-6 pt-4" style={{ borderTop: `1px solid ${MP.border}` }} open={!!sp.region}>
              <summary className="cursor-pointer text-[13px] font-semibold" style={{ color: MP.ink }}>
                Region{sp.region ? ` · ${sp.region}` : ''}
              </summary>
              <ul className="mt-2 grid grid-cols-2 gap-x-3 lg:grid-cols-1 lg:space-y-1">
                {GHANA_REGIONS.map((r) => (
                  <li key={r}>
                    <Link
                      href={`/browse${buildQuery(sp, { region: sp.region === r ? undefined : r, page: undefined })}`}
                      className="inline-block py-1 text-[14px] transition-colors hover:underline lg:py-0.5 lg:text-[13px]"
                      style={{ color: sp.region === r ? MP.primary : MP.textSecondary, fontWeight: sp.region === r ? 600 : 400 }}
                    >
                      {r}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          </div>
          </FiltersDisclosure>
        </aside>

        {/* ── Results ────────────────────────────────────────── */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div>
              <h1 className="font-display text-[22px] font-bold tracking-[-0.01em] sm:text-[26px]" style={{ color: MP.ink }}>
                {nounPlural}{place ? ` in ${place}` : ''}
              </h1>
              <p className="mt-0.5 text-[14px]" style={{ color: MP.textSecondary }} aria-live="polite">
                {filtered.length} {filtered.length === 1 ? nounSingular : `${nounSingular}s`} found
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ListingSortSelect current={sort} />
              <div className="hidden overflow-hidden rounded-lg sm:flex" style={{ border: `1px solid ${MP.border}` }}>
                <Link
                  href={`/browse${buildQuery(sp, { view: 'list' })}`}
                  aria-current={view === 'list' ? 'true' : undefined}
                  className="bd-focus flex min-h-[40px] items-center gap-1.5 px-3 text-[13px] font-medium transition-colors duration-150"
                  style={view === 'list' ? { background: MP.surfaceSoft, color: MP.ink } : { background: MP.surface, color: MP.textSecondary }}
                >
                  <ListIcon className="h-4 w-4" aria-hidden="true" /> List
                </Link>
                <Link
                  href={`/browse${buildQuery(sp, { view: 'grid' })}`}
                  aria-current={view === 'grid' ? 'true' : undefined}
                  className="bd-focus flex min-h-[40px] items-center gap-1.5 px-3 text-[13px] font-medium transition-colors duration-150"
                  style={view === 'grid' ? { background: MP.surfaceSoft, color: MP.ink } : { background: MP.surface, color: MP.textSecondary }}
                >
                  <LayoutGrid className="h-4 w-4" aria-hidden="true" /> Grid
                </Link>
              </div>
            </div>
          </div>

          {hostels.length === 0 ? (
            <div className="mt-5 flex flex-col items-center justify-center gap-3 rounded-xl px-6 py-14 text-center" style={{ background: MP.surfaceSoft }}>
              <SearchX className="h-6 w-6" style={{ color: MP.textSecondary }} aria-hidden="true" />
              <p className="font-medium" style={{ color: MP.ink }}>No {nounSingular}s found</p>
              <p className="max-w-xs text-sm" style={{ color: MP.textSecondary }}>
                {hasSearch ? 'Nothing matches this search yet. Try a nearby town or fewer filters.' : 'New listings are on the way — check back soon.'}
              </p>
              {hasSearch && (
                <Link
                  href={businessType === 'hostel' ? '/browse' : `/browse?type=${businessType}`}
                  className="bd-focus mt-2 inline-flex min-h-[40px] items-center rounded-lg border bg-white px-4 text-[14px] font-semibold"
                  style={{ color: MP.primary, borderColor: MP.borderStrong }}
                >
                  Clear search
                </Link>
              )}
            </div>
          ) : view === 'grid' ? (
            <div className="mt-5 grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {hostels.map((h) => <ListingCard key={h.slug} listing={h} />)}
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {hostels.map((h) => <ListingListRow key={h.slug} listing={h} />)}
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={`/browse${buildQuery(sp, { page: String(p) })}`}
                  aria-current={p === page ? 'page' : undefined}
                  className="bd-focus flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg px-3 text-sm transition-colors duration-150"
                  style={p === page
                    ? { background: MP.primary, color: '#fff' }
                    : { border: `1px solid ${MP.border}`, color: MP.textSecondary }}
                >
                  {p}
                </Link>
              ))}
            </div>
          )}

          <div className="mt-10 flex items-center justify-center gap-1.5 text-[13px]" style={{ color: MP.textSecondary }}>
            Run {businessType === 'apartment' ? 'an' : 'a'} {nounSingular}?
            <Link href="/list-your-property" className="font-semibold hover:underline" style={{ color: MP.primary }}>
              List it on Beddilo <ChevronRight className="inline h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>

      <MarketplaceFooter />
    </div>
  )
}
