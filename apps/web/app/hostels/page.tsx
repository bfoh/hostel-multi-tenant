import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Search, MapPin, LayoutGrid, List as ListIcon, ChevronRight } from 'lucide-react'
import { searchHostels } from '@/lib/directory'
import { HostelCard } from '@/components/public/hostel-card'
import { HostelListRow } from '@/components/public/hostel-list-row'
import { HostelSortSelect } from '@/components/public/hostel-sort-select'

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

  const { hostels: allResults, total } = await searchHostels({
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
    <div className="min-h-screen bg-neutral-50">
      {/* ── Search bar ─────────────────────────────────────────── */}
      <div className="bg-[#003580] py-4">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-3 flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/logo-mark.svg" alt="GH Hostels" width={28} height={28} className="rounded" />
              <span className="text-[13px] font-bold tracking-wide text-white">GH-HOSTELS</span>
            </Link>
          </div>
          <form action="/hostels" method="get" className="flex flex-col gap-2 rounded-lg bg-white p-2 shadow-lg sm:flex-row">
            <div className="flex flex-1 items-center gap-2 border-b border-neutral-200 px-3 py-2.5 sm:border-b-0 sm:border-r">
              <Search className="h-4 w-4 shrink-0 text-neutral-400" />
              <input
                name="q"
                defaultValue={sp.q ?? ''}
                placeholder="Hostel name or campus"
                className="w-full text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
              />
            </div>
            <div className="flex flex-1 items-center gap-2 border-b border-neutral-200 px-3 py-2.5 sm:border-b-0 sm:border-r">
              <MapPin className="h-4 w-4 shrink-0 text-neutral-400" />
              <input
                name="city"
                defaultValue={sp.city ?? ''}
                placeholder="City / area"
                className="w-full text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
              />
            </div>
            <select name="region" defaultValue={sp.region ?? ''} className="rounded-md px-3 py-2.5 text-sm text-neutral-900 sm:w-44">
              <option value="">All regions</option>
              {GHANA_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <button type="submit" className="rounded-md bg-[#0071c2] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#00487a]">
              Search
            </button>
          </form>
        </div>
      </div>

      {/* ── Breadcrumb ─────────────────────────────────────────── */}
      <div className="mx-auto max-w-6xl px-4 py-3 text-[13px] text-neutral-500 sm:px-6">
        <Link href="/" className="text-[#0071c2] hover:underline">Home</Link>
        <span className="mx-1.5">›</span>
        {sp.region ? (
          <>
            <Link href="/hostels" className="text-[#0071c2] hover:underline">Hostels</Link>
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
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <h2 className="text-[15px] font-bold text-neutral-900">Filter by</h2>

            <form action="/hostels" method="get" className="mt-4 space-y-5">
              {sp.q && <input type="hidden" name="q" value={sp.q} />}
              {sp.city && <input type="hidden" name="city" value={sp.city} />}
              {sp.region && <input type="hidden" name="region" value={sp.region} />}

              <div>
                <p className="text-[13px] font-semibold text-neutral-800">Your budget (per stay)</p>
                {allResults.length > 0 && (
                  <p className="mt-0.5 text-[12px] text-neutral-500">
                    GH₵{priceBounds.lo.toFixed(0)} – GH₵{priceBounds.hi.toFixed(0)}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <input
                    name="min" type="number" defaultValue={sp.min ?? ''} placeholder="Min"
                    className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-[13px] text-neutral-900 outline-none focus:border-[#0071c2]"
                  />
                  <span className="text-neutral-400">–</span>
                  <input
                    name="max" type="number" defaultValue={sp.max ?? ''} placeholder="Max"
                    className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-[13px] text-neutral-900 outline-none focus:border-[#0071c2]"
                  />
                </div>
                <button type="submit" className="mt-2 text-[12px] font-semibold text-[#0071c2] hover:underline">
                  Apply
                </button>
              </div>
            </form>

            <div className="mt-6 border-t border-neutral-200 pt-4">
              <p className="text-[13px] font-semibold text-neutral-800">Region</p>
              <ul className="mt-2 space-y-1.5">
                {GHANA_REGIONS.map((r) => (
                  <li key={r}>
                    <Link
                      href={`/hostels?${buildQuery(sp, { region: sp.region === r ? undefined : r, page: undefined })}`}
                      className={`text-[13px] transition-colors ${sp.region === r ? 'font-semibold text-[#0071c2]' : 'text-neutral-600 hover:text-[#0071c2]'}`}
                    >
                      {r}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>

        {/* ── Results ────────────────────────────────────────── */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-[20px] font-bold text-neutral-900">
              {filtered.length} hostel{filtered.length === 1 ? '' : 's'} found
              {sp.region ? ` in ${sp.region}` : sp.city ? ` in ${sp.city}` : ''}
            </h1>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-[13px] text-neutral-600">
                <span>Sort:</span>
                <HostelSortSelect current={sort} />
              </div>
              <div className="flex overflow-hidden rounded-md border border-neutral-300">
                <Link
                  href={`/hostels?${buildQuery(sp, { view: 'list' })}`}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-[12px] ${view === 'list' ? 'bg-[#0071c2] text-white' : 'bg-white text-neutral-600'}`}
                >
                  <ListIcon className="h-3.5 w-3.5" /> List
                </Link>
                <Link
                  href={`/hostels?${buildQuery(sp, { view: 'grid' })}`}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-[12px] ${view === 'grid' ? 'bg-[#0071c2] text-white' : 'bg-white text-neutral-600'}`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" /> Grid
                </Link>
              </div>
            </div>
          </div>

          {hostels.length === 0 ? (
            <div className="mt-8 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-neutral-300 bg-white py-20 text-center">
              <p className="font-medium text-neutral-700">No hostels found</p>
              <p className="text-sm text-neutral-500">Try a different search or check back soon — new hostels list every week.</p>
            </div>
          ) : view === 'grid' ? (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {hostels.map((h) => <HostelCard key={h.slug} hostel={h} />)}
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {hostels.map((h) => <HostelListRow key={h.slug} hostel={h} />)}
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={`/hostels?${buildQuery(sp, { page: String(p) })}`}
                  className={`rounded-md px-3 py-1.5 text-sm ${p === page ? 'bg-[#0071c2] text-white' : 'border border-neutral-300 text-neutral-700 hover:bg-neutral-100'}`}
                >
                  {p}
                </Link>
              ))}
            </div>
          )}

          <div className="mt-10 flex items-center justify-center gap-1.5 text-[13px] text-neutral-500">
            Run a hostel?
            <Link href="/signup?plan=trial&source=directory" className="font-semibold text-[#0071c2] hover:underline">
              List yours free <ChevronRight className="inline h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
