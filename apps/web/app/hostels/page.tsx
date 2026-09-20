import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Search, MapPin, Building2, ArrowRight } from 'lucide-react'
import { searchHostels } from '@/lib/directory'
import { formatGHS } from '@/lib/utils'

const INK = '#0A0A08'
const IVORY = '#F5E9D2'
const GOLD = '#D4A24C'
const GOLD_SOFT = '#F5C26B'
const HAIR = 'rgba(245,233,210,0.10)'
const HAIR_STRONG = 'rgba(245,233,210,0.18)'
const FOREST_MID = '#1B6E54'

const GHANA_REGIONS = [
  'Ahafo', 'Ashanti', 'Bono', 'Bono East', 'Central', 'Eastern',
  'Greater Accra', 'North East', 'Northern', 'Oti', 'Savannah',
  'Upper East', 'Upper West', 'Volta', 'Western', 'Western North',
]

export const metadata: Metadata = {
  title: 'Find a Hostel — GH Hostels',
  description: 'Search and book student hostels near your campus in Ghana — real-time availability, no middleman.',
}

export default async function HostelsDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; region?: string; q?: string; page?: string }>
}) {
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const { hostels, total } = await searchHostels({
    city: sp.city, region: sp.region, q: sp.q, page,
  })
  const totalPages = Math.max(1, Math.ceil(total / 20))

  return (
    <div className="min-h-screen text-[#f5e9d2] antialiased" style={{ background: INK }}>
      <nav
        className="sticky top-0 z-50 backdrop-blur-2xl"
        style={{ background: 'rgba(10,10,8,0.72)', borderBottom: `1px solid ${HAIR}` }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo-mark.svg" alt="GH Hostels" width={32} height={32} />
            <span className="text-[14px] font-bold tracking-[0.14em]" style={{ color: IVORY }}>GH-HOSTELS</span>
          </Link>
          <Link
            href="/signup?plan=trial&source=directory"
            className="rounded-full px-4 py-2 text-[13px] font-semibold"
            style={{ background: GOLD, color: INK }}
          >
            List your hostel free
          </Link>
        </div>
      </nav>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <h1
          className="text-[28px] font-normal leading-[1.1] tracking-[-0.03em] sm:text-[38px]"
          style={{ fontFamily: 'Georgia, serif', color: IVORY }}
        >
          Find your next hostel.
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'rgba(245,233,210,0.6)' }}>
          {total} hostel{total === 1 ? '' : 's'} listed across Ghana — search by campus, city, or region.
        </p>

        <form
          method="get"
          className="mt-6 flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center"
          style={{ border: `1px solid ${HAIR_STRONG}`, background: 'rgba(245,233,210,0.03)' }}
        >
          <div className="flex flex-1 items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: 'rgba(245,233,210,0.05)' }}>
            <Search className="h-4 w-4 shrink-0" style={{ color: GOLD }} />
            <input
              name="q"
              defaultValue={sp.q ?? ''}
              placeholder="Search by hostel name (e.g. Legon, KNUST)"
              className="w-full bg-transparent text-sm outline-none placeholder:text-[rgba(245,233,210,0.35)]"
              style={{ color: IVORY }}
            />
          </div>
          <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 sm:w-48" style={{ background: 'rgba(245,233,210,0.05)' }}>
            <MapPin className="h-4 w-4 shrink-0" style={{ color: GOLD }} />
            <input
              name="city"
              defaultValue={sp.city ?? ''}
              placeholder="City / area"
              className="w-full bg-transparent text-sm outline-none placeholder:text-[rgba(245,233,210,0.35)]"
              style={{ color: IVORY }}
            />
          </div>
          <select
            name="region"
            defaultValue={sp.region ?? ''}
            className="rounded-xl px-3 py-2.5 text-sm sm:w-44"
            style={{ background: 'rgba(245,233,210,0.05)', color: IVORY }}
          >
            <option value="" style={{ color: INK }}>All regions</option>
            {GHANA_REGIONS.map((r) => (
              <option key={r} value={r} style={{ color: INK }}>{r}</option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-xl px-5 py-2.5 text-sm font-semibold"
            style={{ background: GOLD, color: INK }}
          >
            Search
          </button>
        </form>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        {hostels.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-3 rounded-2xl py-20 text-center"
            style={{ border: `1px dashed ${HAIR_STRONG}` }}
          >
            <Building2 className="h-10 w-10" style={{ color: 'rgba(245,233,210,0.3)' }} />
            <p className="font-medium" style={{ color: IVORY }}>No hostels found</p>
            <p className="text-sm" style={{ color: 'rgba(245,233,210,0.5)' }}>
              Try a different search or check back soon — new hostels list every week.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {hostels.map((h) => (
              <Link
                key={h.slug}
                href={`/hostels/${h.slug}`}
                className="group rounded-2xl p-5 transition-colors hover:bg-[rgba(245,233,210,0.04)]"
                style={{
                  border: `1px solid ${HAIR_STRONG}`,
                  background: 'linear-gradient(180deg, rgba(15,76,58,0.14) 0%, rgba(15,76,58,0.03) 100%)',
                }}
              >
                <div className="flex items-start gap-3">
                  {h.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={h.logo_url} alt={h.name} className="h-11 w-11 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: `linear-gradient(135deg, ${FOREST_MID}, ${GOLD})` }}
                    >
                      <span className="text-[15px] font-bold text-white">{h.name.slice(0, 1).toUpperCase()}</span>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[15px] font-semibold" style={{ color: IVORY }}>{h.name}</h3>
                    {(h.address_city || h.address_region) && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs" style={{ color: 'rgba(245,233,210,0.5)' }}>
                        <MapPin className="h-3 w-3" />
                        {[h.address_city, h.address_region].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                </div>
                {h.tagline && (
                  <p className="mt-3 line-clamp-2 text-[13px]" style={{ color: 'rgba(245,233,210,0.55)' }}>
                    {h.tagline}
                  </p>
                )}
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-[13px] font-semibold" style={{ color: GOLD_SOFT }}>
                    From {formatGHS(h.from_rate)}
                  </span>
                  <span className="flex items-center gap-1 text-[12px] font-medium" style={{ color: 'rgba(245,233,210,0.5)' }}>
                    View <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
              const qs = new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.city ? { city: sp.city } : {}), ...(sp.region ? { region: sp.region } : {}), page: String(p) })
              return (
                <Link
                  key={p}
                  href={`/hostels?${qs.toString()}`}
                  className="rounded-lg px-3 py-1.5 text-sm"
                  style={{
                    background: p === page ? GOLD : 'transparent',
                    color: p === page ? INK : IVORY,
                    border: p === page ? 'none' : `1px solid ${HAIR_STRONG}`,
                  }}
                >
                  {p}
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
