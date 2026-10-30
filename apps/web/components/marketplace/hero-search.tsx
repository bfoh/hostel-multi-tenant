'use client'

import { useLayoutEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BedDouble, Building2, Home, Compass, Landmark, Search, MapPin, Sparkles } from 'lucide-react'

/**
 * Expedia/Booking-style vertical-tabbed hero search. Hostels, hotels, and
 * apartments are live verticals — the search card was staged for all five
 * tabs from the start so it wouldn't need reshaping as each launched.
 * Hotels and apartments both live under the tenants.business_type='hotel'
 * pool (that column also drives subdomain routing, so it stays binary), but
 * are split into separate marketplace listings via tenants.accommodation_type
 * — see lib/directory.ts's MarketplaceVertical. "Things to Do" / "Places to
 * Visit" remain on the roadmap — unrelated to accommodation, switching to
 * either shows a "coming soon" panel instead of navigating anywhere.
 */

export type TabKey = 'hostels' | 'hotels' | 'apartments' | 'things-to-do' | 'places'

const TABS: Array<{ key: TabKey; label: string; icon: typeof BedDouble; enabled: boolean }> = [
  { key: 'hostels', label: 'Hostels', icon: BedDouble, enabled: true },
  { key: 'hotels', label: 'Hotels', icon: Building2, enabled: true },
  { key: 'apartments', label: 'Apartments', icon: Home, enabled: true },
  { key: 'things-to-do', label: 'Things to Do', icon: Compass, enabled: false },
  { key: 'places', label: 'Places to Visit', icon: Landmark, enabled: false },
]

/** Each tab maps to its own marketplace vertical — see MarketplaceVertical. */
export const SEARCH_BUSINESS_TYPE: Partial<Record<TabKey, 'hostel' | 'hotel' | 'apartment'>> = {
  hostels: 'hostel',
  hotels: 'hotel',
  apartments: 'apartment',
}

/** Label + placeholder for the name field (?q=, matched against the
 *  property name) on each live tab. */
const NAME_FIELD: Partial<Record<TabKey, { label: string; placeholder: string }>> = {
  hostels: { label: 'Hostel or campus', placeholder: 'e.g. Legon, KNUST, UCC' },
  hotels: { label: 'Hotel or guesthouse', placeholder: 'Search by name' },
  apartments: { label: 'Apartment or short-let', placeholder: 'Search by name' },
}

/**
 * Quick-search chips below the search card. Hostels keeps the original
 * campus names; hotels and apartments get Ghana destination names instead
 * (matching the destinations marquee on the hotel /for-owners page) since
 * "Legon"/"KNUST" as a hotel search suggestion would make no sense.
 *
 * Each chip fills the same field a visitor would type it into: campuses go
 * to the name/campus field (?q=, matched against the property name) and
 * towns to the destination field (?city=, matched against address_city) —
 * a town sent as ?q= only finds properties with the town in their name.
 */
type QuickLink = { label: string; field: 'q' | 'city' }

const DESTINATIONS: QuickLink[] = ['Accra', 'Kumasi', 'Cape Coast', 'Elmina', 'Aburi']
  .map((label) => ({ label, field: 'city' as const }))

const QUICK_LINKS: Partial<Record<TabKey, QuickLink[]>> = {
  hostels: [
    { label: 'Legon', field: 'q' },
    { label: 'KNUST', field: 'q' },
    { label: 'UCC', field: 'q' },
    { label: 'Cape Coast', field: 'city' },
    { label: 'Kumasi', field: 'city' },
  ],
  hotels: DESTINATIONS,
  apartments: DESTINATIONS,
}

/** /browse URL for a quick-search chip. Hostel is /browse's default type. */
export function quickSearchHref(link: QuickLink, type?: 'hostel' | 'hotel' | 'apartment'): string {
  const params = new URLSearchParams({ [link.field]: link.label })
  if (type && type !== 'hostel') params.set('type', type)
  return `/browse?${params.toString()}`
}

export function HeroSearch({ initialTab }: { initialTab?: TabKey } = {}) {
  const router = useRouter()
  const [active, setActive] = useState<TabKey>(initialTab ?? 'hostels')

  // Enabled-tab clicks also update ?tab= on the current URL so the
  // homepage's server-rendered Featured section (which can't see this
  // component's client state directly) can react to the selection too.
  function selectTab(key: TabKey, enabled: boolean) {
    setActive(key)
    if (enabled) router.push(`/?tab=${key}`, { scroll: false })
  }
  const activeTab = TABS.find((tab) => tab.key === active)!

  const scrollRef = useRef<HTMLDivElement>(null)
  const [showLeftFade, setShowLeftFade] = useState(false)
  const [showRightFade, setShowRightFade] = useState(false)
  // Centering an overflowing scroll container makes its start unreachable in
  // some browsers (scrollLeft would need to go negative) — only center the
  // tabs once we've measured that they actually fit without scrolling.
  const [hasOverflow, setHasOverflow] = useState(true)

  const updateFades = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setShowLeftFade(el.scrollLeft > 4)
    setShowRightFade(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
    setHasOverflow(el.scrollWidth > el.clientWidth + 4)
  }, [])

  useLayoutEffect(() => {
    updateFades()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', updateFades, { passive: true })
    window.addEventListener('resize', updateFades)
    return () => {
      el.removeEventListener('scroll', updateFades)
      window.removeEventListener('resize', updateFades)
    }
  }, [updateFades])

  const quickLinks = QUICK_LINKS[active]
  const quickLinksType = SEARCH_BUSINESS_TYPE[active]
  const nameField = NAME_FIELD[active]

  return (
    <>
    <div
      className="mp-reveal mx-auto rounded-[28px] border border-bd-teal/10 bg-white p-3 shadow-[0_30px_60px_-30px_rgba(11,31,35,0.45)] sm:p-5"
      style={{ animationDelay: '180ms' }}
    >
      <div className="relative">
        {showLeftFade && (
          <div
            className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-10 rounded-l-xl bg-gradient-to-r from-white to-white/0"
            aria-hidden="true"
          />
        )}
        <div
          ref={scrollRef}
          role="group"
          aria-label="Type of stay"
          className={`mp-no-scrollbar flex items-center gap-1.5 overflow-x-auto p-0.5 sm:gap-2 ${hasOverflow ? '' : 'sm:justify-center'}`}
        >
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = tab.key === active
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => selectTab(tab.key, tab.enabled)}
                aria-pressed={isActive}
                className={[
                  'bd-focus inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5 text-[14px] font-semibold transition-colors',
                  isActive
                    ? 'bg-bd-teal text-bd-ivory shadow-sm'
                    : 'text-bd-slate hover:bg-bd-teal/5 hover:text-bd-teal',
                ].join(' ')}
              >
                <Icon className={`h-[18px] w-[18px] ${isActive ? 'text-bd-amber' : ''}`} strokeWidth={isActive ? 2.2 : 1.8} aria-hidden="true" />
                {tab.label}
                {!tab.enabled && (
                  <span
                    className={`rounded-full px-1.5 py-[1px] text-[10px] font-bold uppercase tracking-wide ${
                      isActive ? 'bg-bd-amber text-bd-teal' : 'bg-bd-amber-100 text-bd-amber-700'
                    }`}
                  >
                    Soon
                  </span>
                )}
              </button>
            )
          })}
        </div>
        {showRightFade && (
          <div
            className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-10 rounded-r-xl bg-gradient-to-l from-white to-white/0"
            aria-hidden="true"
          />
        )}
      </div>

      {activeTab.enabled ? (
        <form
          action="/browse"
          method="get"
          role="search"
          aria-label={`Search ${activeTab.label.toLowerCase()}`}
          className="mt-3 grid gap-2 sm:mt-4 sm:grid-cols-[1.25fr_1fr_auto] sm:gap-3"
        >
          <input type="hidden" name="type" value={SEARCH_BUSINESS_TYPE[active] ?? 'hostel'} />
          <label className="group/field flex cursor-text items-center gap-3 rounded-2xl border border-bd-teal/15 bg-bd-ivory-50 px-4 py-2.5 transition-colors focus-within:border-bd-teal focus-within:bg-white focus-within:ring-2 focus-within:ring-bd-teal/15 hover:border-bd-teal/30">
            <Search className="h-5 w-5 shrink-0 text-bd-teal/70" aria-hidden="true" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-bd-slate">
                {nameField?.label ?? 'Property name'}
              </span>
              <input
                name="q"
                placeholder={nameField?.placeholder ?? 'Search by name'}
                className="w-full bg-transparent text-[15px] text-bd-teal outline-none placeholder:text-bd-slate/70"
              />
            </span>
          </label>
          <label className="flex cursor-text items-center gap-3 rounded-2xl border border-bd-teal/15 bg-bd-ivory-50 px-4 py-2.5 transition-colors focus-within:border-bd-teal focus-within:bg-white focus-within:ring-2 focus-within:ring-bd-teal/15 hover:border-bd-teal/30">
            <MapPin className="h-5 w-5 shrink-0 text-bd-teal/70" aria-hidden="true" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-bd-slate">Destination</span>
              <input
                name="city"
                placeholder="City or town"
                autoComplete="address-level2"
                className="w-full bg-transparent text-[15px] text-bd-teal outline-none placeholder:text-bd-slate/70"
              />
            </span>
          </label>
          <button
            type="submit"
            className="bd-focus inline-flex min-h-[56px] shrink-0 items-center justify-center gap-2 rounded-2xl bg-bd-amber px-8 text-[16px] font-bold text-bd-teal shadow-[0_10px_24px_-12px_rgba(227,162,63,0.9)] transition-all duration-200 hover:bg-bd-amber-600 active:scale-[0.98] motion-reduce:active:scale-100"
          >
            <Search className="h-5 w-5" strokeWidth={2.4} aria-hidden="true" />
            Search
          </button>
        </form>
      ) : (
        <div
          className="mt-3 flex flex-col items-center gap-4 rounded-2xl bg-bd-ivory-50 px-4 py-7 text-center sm:mt-4 sm:flex-row sm:justify-between sm:gap-4 sm:px-6 sm:text-left"
          role="status"
        >
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-bd-amber-100">
              <Sparkles className="h-5 w-5 text-bd-amber-700" aria-hidden="true" />
            </span>
            <div>
              <p className="font-display text-base font-semibold text-bd-teal">{activeTab.label} is coming soon</p>
              <p className="text-[14px] text-bd-slate">We&apos;re focused on places to stay for now — check back soon.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => selectTab('hostels', true)}
            className="bd-focus shrink-0 rounded-full bg-bd-teal px-6 py-3 text-[15px] font-semibold text-bd-ivory transition-colors hover:bg-bd-teal-900"
          >
            Browse hostels
          </button>
        </div>
      )}
    </div>

    {quickLinks && (
      <div
        className="mp-reveal relative z-0 mx-auto mt-6 flex flex-wrap items-center justify-center gap-2"
        style={{ animationDelay: '220ms' }}
      >
        <span className="mr-1 text-[13px] font-medium text-bd-slate">Popular:</span>
        {quickLinks.map((link) => (
          <Link
            key={link.label}
            href={quickSearchHref(link, quickLinksType)}
            className="bd-focus inline-flex items-center gap-1.5 rounded-full border border-bd-teal/15 bg-white px-3.5 py-1.5 text-[13px] font-medium text-bd-teal transition-colors hover:border-bd-teal hover:bg-bd-teal hover:text-bd-ivory"
          >
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {link.label}
          </Link>
        ))}
      </div>
    )}
    </>
  )
}
