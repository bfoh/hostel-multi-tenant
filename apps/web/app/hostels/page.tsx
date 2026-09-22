import type { Metadata } from 'next'
import Link from 'next/link'
import { Search, MapPin, LayoutGrid, List as ListIcon, ChevronRight, SearchX } from 'lucide-react'
import { searchHostels } from '@/lib/directory'
import { HostelCard } from '@/components/public/hostel-card'
import { HostelListRow } from '@/components/public/hostel-list-row'
import { HostelSortSelect } from '@/components/public/hostel-sort-select'
import { MarketplaceNav } from '@/components/marketplace/marketplace-nav'
import { MarketplaceFooter } from '@/components/marketplace/marketplace-footer'
import { MP } from '@/lib/marketplace-theme'

const GHANA_REGIONS = [
  'Ahafo', 'Ashanti', 'Bono', 'Bono East', 'Central', 'Eastern',
  'Greater Accra', 'North East', 'Northern', 'Oti', 'Savannah',
  'Upper East', 'Upper West', 'Volta', 'Western', 'Western North',
]

export const metadata: Metadata = {
  title: 'Find a Hostel — GH Hostels',
  description: 'Search and book student hostels near your campus in Ghana — real-time availability, no middleman.',
}

function buildQuery(sp: Record<string, string | undefined>, overrides: Record<string, string | undefined>) {
  const merged = { ...sp, ...overrides }
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(merged)) {
    if (v) qs.set(k, v)
  }
  return qs.toString()
}

export default async function HostelsDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; region?: string; q?: string; page?: string; sort?: string; view?: string; min?: string; max?: string }>
}) {
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const sort = (['name', 'price_asc', 'price_desc'].includes(sp.sort ?? '') ? sp.sort : 'name') as 'name' | 'price_asc' | 'price_desc'
  const view = sp.view === 'grid' ? 'grid' : 'list'

  const { hostels: allResults } = await searchHostels({
    city: sp.city, region: sp.region, q: sp.q, sort, limit: 1000,
  })

  const min = sp.min ? Number(sp.min) : null
  const max = sp.max ? Number(sp.max) : null
  const filtered = allResults.filter((h) => (min == null || h.from_rate >= min * 100) && (max == null || h.from_rate <= max * 100))

  const pageSize = 20
  const pageStart = (page - 1) * pageSize
  const hostels = filtered.slice(pageStart, pageStart + pageSize)
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))

  const priceBounds = allResults.length > 0
    ? { lo: Math.min(...allResults.map((h) => h.from_rate)) / 100, hi: Math.max(...allResults.map((h) => h.from_rate)) / 100 }
    : { lo: 0, hi: 0 }

  return (
    <div className="relative min-h-screen" style={{ background: MP.bg }}>
      <div className="pointer-events-none fixed inset-0 -z-10 platform-adinkra-bg-light" aria-hidden="true" />

      <MarketplaceNav />

      {/* ── Search bar ─────────────────────────────────────────── */}
      <div className="py-6" style={{ background: MP.surfaceSoft, borderBottom: `1px solid ${MP.border}` }}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <form action="/hostels" method="get" className="flex flex-col gap-2 rounded-xl bg-white p-2 shadow-sm sm:flex-row" style={{ border: `1px solid ${MP.border}` }}>
            <div className="flex flex-1 items-center gap-2 border-b border-neutral-100 px-3 py-2.5 sm:border-b-0 sm:border-r">
              <Search className="h-4 w-4 shrink-0" style={{ color: MP.goldDeep }} />
              <input
                name="q"
                defaultValue={sp.q ?? ''}
                placeholder="Hostel name or campus"
                className="w-full text-sm outline-none placeholder:text-neutral-400"
                style={{ color: MP.ink }}
              />
            </div>
            <div className="flex flex-1 items-center gap-2 border-b border-neutral-100 px-3 py-2.5 sm:border-b-0 sm:border-r">
              <MapPin className="h-4 w-4 shrink-0" style={{ color: MP.goldDeep }} />
              <input
                name="city"
                defaultValue={sp.city ?? ''}
                placeholder="City / area"
                className="w-full text-sm outline-none placeholder:text-neutral-400"
                style={{ color: MP.ink }}
              />
            </div>
            <select
              name="region" defaultValue={sp.region ?? ''}
              className="cursor-pointer rounded-md border bg-white px-3 py-2.5 text-sm sm:w-44"
              style={{ color: MP.ink, borderColor: MP.border }}
            >
              <option value="">All regions</option>
              {GHANA_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <button
              type="submit"
              className="cursor-pointer rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
              style={{ background: MP.green }}
            >
              Search
            </button>
          </form>
        </div>
      </div>

      {/* ── Breadcrumb ─────────────────────────────────────────── */}
      <div className="mx-auto max-w-6xl px-4 py-3 text-[13px] sm:px-6" style={{ color: MP.textSecondary }}>
        <Link href="/" className="hover:underline" style={{ color: MP.green }}>Home</Link>
        <span className="mx-1.5">›</span>
        {sp.region ? (
          <>
            <Link href="/hostels" className="hover:underline" style={{ color: MP.green }}>Hostels</Link>
            <span className="mx-1.5">›</span>
            <span>{sp.region}</span>
          </>
        ) : (
          <span>Hostels</span>
        )}
      </div>

      <div className="mx-auto max-w-6xl gap-6 px-4 pb-20 sm:px-6 lg:flex">
        {/* ── Filters sidebar ─────────────────────────────────── */}
        <aside className="mb-6 w-full shrink-0 lg:mb-0 lg:w-64">
          <div className="rounded-xl bg-white p-4" style={{ border: `1px solid ${MP.border}` }}>
            <h2 className="text-[15px] font-bold" style={{ color: MP.ink }}>Filter by</h2>

            <form action="/hostels" method="get" className="mt-4 space-y-5">
              {sp.q && <input type="hidden" name="q" value={sp.q} />}
              {sp.city && <input type="hidden" name="city" value={sp.city} />}
              {sp.region && <input type="hidden" name="region" value={sp.region} />}

              <div>
                <p className="text-[13px] font-semibold" style={{ color: MP.ink }}>Your budget (per stay)</p>
                {allResults.length > 0 && (
                  <p className="mt-0.5 text-[12px]" style={{ color: MP.textSecondary }}>
                    GH₵{priceBounds.lo.toFixed(0)} – GH₵{priceBounds.hi.toFixed(0)}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <input
                    name="min" type="number" defaultValue={sp.min ?? ''} placeholder="Min"
                    className="w-full rounded-md border px-2.5 py-1.5 text-[13px] outline-none"
                    style={{ borderColor: MP.border, color: MP.ink }}
                  />
                  <span style={{ color: MP.textSecondary }}>–</span>
                  <input
                    name="max" type="number" defaultValue={sp.max ?? ''} placeholder="Max"
                    className="w-full rounded-md border px-2.5 py-1.5 text-[13px] outline-none"
                    style={{ borderColor: MP.border, color: MP.ink }}
                  />
                </div>
                <button type="submit" className="mt-2 text-[12px] font-semibold hover:underline" style={{ color: MP.green }}>
                  Apply
                </button>
              </div>
            </form>

            <details className="mt-6 pt-4" style={{ borderTop: `1px solid ${MP.border}` }} open={!!sp.region}>
              <summary className="cursor-pointer text-[13px] font-semibold" style={{ color: MP.ink }}>
                Region{sp.region ? ` · ${sp.region}` : ''}
              </summary>
              <ul className="mt-2 space-y-1.5">
                {GHANA_REGIONS.map((r) => (
                  <li key={r}>
                    <Link
                      href={`/hostels?${buildQuery(sp, { region: sp.region === r ? undefined : r, page: undefined })}`}
                      className="text-[13px] transition-colors hover:underline"
                      style={{ color: sp.region === r ? MP.green : MP.textSecondary, fontWeight: sp.region === r ? 600 : 400 }}
                    >
                      {r}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </aside>

        {/* ── Results ────────────────────────────────────────── */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-[20px] font-bold" style={{ color: MP.ink }}>
              {filtered.length} hostel{filtered.length === 1 ? '' : 's'} found
              {sp.region ? ` in ${sp.region}` : sp.city ? ` in ${sp.city}` : ''}
            </h1>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-[13px]" style={{ color: MP.textSecondary }}>
                <span>Sort:</span>
                <HostelSortSelect current={sort} />
              </div>
              <div className="flex overflow-hidden rounded-md" style={{ border: `1px solid ${MP.border}` }}>
                <Link
                  href={`/hostels?${buildQuery(sp, { view: 'list' })}`}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] transition-colors duration-150"
                  style={view === 'list' ? { background: MP.green, color: '#fff' } : { background: MP.surface, color: MP.textSecondary }}
                >
                  <ListIcon className="h-3.5 w-3.5" /> List
                </Link>
                <Link
                  href={`/hostels?${buildQuery(sp, { view: 'grid' })}`}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] transition-colors duration-150"
                  style={view === 'grid' ? { background: MP.green, color: '#fff' } : { background: MP.surface, color: MP.textSecondary }}
                >
                  <LayoutGrid className="h-3.5 w-3.5" /> Grid
                </Link>
              </div>
            </div>
          </div>

          {hostels.length === 0 ? (
            <div className="mt-8 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-white py-20 text-center" style={{ borderColor: MP.borderStrong }}>
              <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: MP.surfaceSoft }}>
                <SearchX className="h-5 w-5" style={{ color: MP.goldDeep }} />
              </span>
              <p className="font-medium" style={{ color: MP.ink }}>No hostels found</p>
              <p className="max-w-xs text-sm" style={{ color: MP.textSecondary }}>Try a different search or check back soon — new hostels list every week.</p>
            </div>
          ) : view === 'grid' ? (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {hostels.map((h, i) => (
                <div key={h.slug} className="mp-reveal" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                  <HostelCard hostel={h} />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {hostels.map((h, i) => (
                <div key={h.slug} className="mp-reveal" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                  <HostelListRow hostel={h} />
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={`/hostels?${buildQuery(sp, { page: String(p) })}`}
                  className="rounded-md px-3 py-1.5 text-sm transition-colors duration-150"
                  style={p === page
                    ? { background: MP.green, color: '#fff' }
                    : { border: `1px solid ${MP.border}`, color: MP.textSecondary }}
                >
                  {p}
                </Link>
              ))}
            </div>
          )}

          <div className="mt-10 flex items-center justify-center gap-1.5 text-[13px]" style={{ color: MP.textSecondary }}>
            Run a hostel?
            <Link href="/signup?plan=trial&source=directory" className="font-semibold hover:underline" style={{ color: MP.green }}>
              List yours free <ChevronRight className="inline h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      <MarketplaceFooter />
    </div>
  )
}
