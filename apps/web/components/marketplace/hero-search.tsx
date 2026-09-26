'use client'

import { useLayoutEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BedDouble, Building2, Home, Compass, Landmark, Search, MapPin, Sparkles } from 'lucide-react'

import { MP } from '@/lib/marketplace-theme'

/**
 * Expedia/Booking-style vertical-tabbed hero search. Hostels, hotels, and
 * apartments are live verticals — the search card was staged for all five
 * tabs from the start so it wouldn't need reshaping as each launched.
 * Hotels and apartments share the exact same business_type='hotel' listing
 * pool (no separate "apartment" vertical exists), so both search /browse
 * with type=hotel. "Things to Do" / "Places to Visit" remain on the
 * roadmap — unrelated to accommodation, switching to either shows a
 * "coming soon" panel instead of navigating anywhere.
 */

export type TabKey = 'hostels' | 'hotels' | 'apartments' | 'things-to-do' | 'places'

const TABS: Array<{ key: TabKey; label: string; icon: typeof BedDouble; enabled: boolean }> = [
  { key: 'hostels', label: 'Hostels', icon: BedDouble, enabled: true },
  { key: 'hotels', label: 'Hotels', icon: Building2, enabled: true },
  { key: 'apartments', label: 'Apartments', icon: Home, enabled: true },
  { key: 'things-to-do', label: 'Things to Do', icon: Compass, enabled: false },
  { key: 'places', label: 'Places to Visit', icon: Landmark, enabled: false },
]

/** Both hotels and apartments query the same business_type='hotel' pool. */
export const SEARCH_BUSINESS_TYPE: Partial<Record<TabKey, 'hostel' | 'hotel'>> = {
  hostels: 'hostel',
  hotels: 'hotel',
  apartments: 'hotel',
}

const SEARCH_PLACEHOLDER: Partial<Record<TabKey, string>> = {
  hostels: 'Hostel name or campus — Legon, KNUST, UCC…',
  hotels: 'Hotel or guesthouse name',
  apartments: 'Apartment or short-let name',
}

/**
 * Quick-search chips below the search card. Hostels keeps the original
 * campus names; hotels and apartments get Ghana destination names instead
 * (matching the destinations marquee on the hotel /for-owners page) since
 * "Legon"/"KNUST" as a hotel search suggestion would make no sense.
 */
const QUICK_LINKS: Partial<Record<TabKey, string[]>> = {
  hostels: ['Legon', 'KNUST', 'UCC', 'Cape Coast', 'Kumasi'],
  hotels: ['Accra', 'Kumasi', 'Cape Coast', 'Elmina', 'Aburi'],
  apartments: ['Accra', 'Kumasi', 'Cape Coast', 'Elmina', 'Aburi'],
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

  return (
    <>
    <div className="mp-reveal mx-auto rounded-[22px] bg-white p-4 shadow-2xl sm:p-6" style={{ animationDelay: '180ms' }}>
      <div className="relative">
        {showLeftFade && (
          <div
            className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-10 rounded-l-xl"
            style={{ background: 'linear-gradient(to right, white, rgba(255,255,255,0))' }}
            aria-hidden="true"
          />
        )}
        <div
          ref={scrollRef}
          className={`mp-no-scrollbar flex items-center gap-1 overflow-x-auto pb-3 sm:gap-3 ${hasOverflow ? '' : 'sm:justify-center'}`}
        >
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = tab.key === active
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => selectTab(tab.key, tab.enabled)}
                aria-current={isActive}
                className="relative flex shrink-0 flex-col items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-[13px] font-medium transition-colors sm:px-5 sm:text-[14px]"
                style={{ color: isActive ? MP.greenDeep : MP.textSecondary }}
              >
                <Icon className="h-[26px] w-[26px]" strokeWidth={isActive ? 2 : 1.6} style={{ color: isActive ? MP.green : MP.textSecondary }} />
                <span className="flex items-center gap-1.5">
                  {tab.label}
                  {!tab.enabled && (
                    <span
                      className="rounded-full px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wide"
                      style={{ background: MP.surfaceSoft, color: MP.goldDeep }}
                    >
                      Soon
                    </span>
                  )}
                </span>
                {isActive && (
                  <span className="absolute -bottom-1 left-4 right-4 h-[3px] rounded-full" style={{ background: MP.green }} />
                )}
              </button>
            )
          })}
        </div>
        {showRightFade && (
          <div
            className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-10 rounded-r-xl"
            style={{ background: 'linear-gradient(to left, white, rgba(255,255,255,0))' }}
            aria-hidden="true"
          />
        )}
      </div>

      <div className="h-px" style={{ background: MP.border }} />

      {activeTab.enabled ? (
        <form action="/browse" method="get" className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center">
          <input type="hidden" name="type" value={SEARCH_BUSINESS_TYPE[active] ?? 'hostel'} />
          <div className="flex flex-1 items-center gap-3 rounded-2xl px-5 py-4" style={{ background: MP.surfaceSoft }}>
            <Search className="h-5 w-5 shrink-0" style={{ color: MP.goldDeep }} />
            <input
              name="q"
              placeholder={SEARCH_PLACEHOLDER[active] ?? 'Search by name'}
              className="w-full bg-transparent text-[15px] outline-none placeholder:text-neutral-400"
              style={{ color: MP.ink }}
            />
          </div>
          <div className="flex items-center gap-3 rounded-2xl px-5 py-4 sm:w-52" style={{ background: MP.surfaceSoft }}>
            <MapPin className="h-5 w-5 shrink-0" style={{ color: MP.goldDeep }} />
            <input
              name="city"
              placeholder="City"
              className="w-full bg-transparent text-[15px] outline-none placeholder:text-neutral-400"
              style={{ color: MP.ink }}
            />
          </div>
          <button
            type="submit"
            className="shrink-0 rounded-2xl px-9 py-4 text-[15px] font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
            style={{ background: MP.green }}
          >
            Search
          </button>
        </form>
      ) : (
        <div className="flex flex-col items-center gap-4 py-8 text-center sm:flex-row sm:justify-between sm:gap-4 sm:py-7 sm:text-left">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full" style={{ background: MP.surfaceSoft }}>
              <Sparkles className="h-5 w-5" style={{ color: MP.goldDeep }} />
            </span>
            <div>
              <p className="text-base font-semibold" style={{ color: MP.ink }}>{activeTab.label} is on the way</p>
              <p className="text-[14px]" style={{ color: MP.textSecondary }}>We're expanding beyond hostels — check back soon.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => selectTab('hostels', true)}
            className="shrink-0 rounded-2xl px-6 py-3 text-[15px] font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
            style={{ background: MP.green }}
          >
            Browse hostels
          </button>
        </div>
      )}
    </div>

    {quickLinks && (
      <div
        className="mp-reveal relative z-0 mx-auto mt-7 flex flex-wrap items-center justify-center gap-2"
        style={{ animationDelay: '220ms' }}
      >
        <span className="text-[12px] font-medium" style={{ color: MP.textSecondary }}>Popular:</span>
        {quickLinks.map((place) => (
          <Link
            key={place}
            href={`/browse?q=${encodeURIComponent(place)}${quickLinksType === 'hotel' ? '&type=hotel' : ''}`}
            className="rounded-full px-3 py-1 text-[12px] font-medium transition-colors hover:bg-[#2F7D57] hover:text-white"
            style={{ border: `1px solid ${MP.border}`, background: MP.surface, color: MP.greenDeep }}
          >
            {place}
          </Link>
        ))}
      </div>
    )}
    </>
  )
}
