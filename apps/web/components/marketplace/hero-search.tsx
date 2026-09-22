'use client'

import { useState } from 'react'
import { BedDouble, Building2, Home, Compass, Landmark, Search, MapPin, Sparkles } from 'lucide-react'

import { MP } from '@/lib/marketplace-theme'

/**
 * Expedia/Booking-style vertical-tabbed hero search. Only "Hostels" is a
 * live vertical today — the rest are staged for the roadmap (hotels,
 * apartments, things to do, places to visit) so the search card doesn't
 * need reshaping again when those launch; switching to a disabled tab
 * shows a "coming soon" panel instead of navigating anywhere.
 */

type TabKey = 'hostels' | 'hotels' | 'apartments' | 'things-to-do' | 'places'

const TABS: Array<{ key: TabKey; label: string; icon: typeof BedDouble; enabled: boolean }> = [
  { key: 'hostels', label: 'Hostels', icon: BedDouble, enabled: true },
  { key: 'hotels', label: 'Hotels', icon: Building2, enabled: false },
  { key: 'apartments', label: 'Apartments', icon: Home, enabled: false },
  { key: 'things-to-do', label: 'Things to Do', icon: Compass, enabled: false },
  { key: 'places', label: 'Places to Visit', icon: Landmark, enabled: false },
]

export function HeroSearch() {
  const [active, setActive] = useState<TabKey>('hostels')
  const activeTab = TABS.find((tab) => tab.key === active)!

  return (
    <div className="mp-reveal mx-auto rounded-2xl bg-white p-2.5 shadow-xl" style={{ animationDelay: '180ms' }}>
      <div className="mp-no-scrollbar flex items-center gap-0.5 overflow-x-auto px-1 pb-1.5 pt-1 sm:gap-1 sm:px-1.5">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = tab.key === active
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActive(tab.key)}
              aria-current={isActive}
              className="relative flex shrink-0 flex-col items-center gap-1 whitespace-nowrap rounded-lg px-3 py-2 text-[12px] font-medium transition-colors sm:px-3.5 sm:text-[13px]"
              style={{ color: isActive ? MP.greenDeep : MP.textSecondary }}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2.25 : 1.75} style={{ color: isActive ? MP.green : MP.textSecondary }} />
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
                <span className="absolute -bottom-0.5 left-3 right-3 h-[2.5px] rounded-full" style={{ background: MP.green }} />
              )}
            </button>
          )
        })}
      </div>

      <div className="h-px" style={{ background: MP.border }} />

      {activeTab.enabled ? (
        <form action="/hostels" method="get" className="flex flex-col gap-2 pt-2.5 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-xl px-4 py-3" style={{ background: MP.surfaceSoft }}>
            <Search className="h-4 w-4 shrink-0" style={{ color: MP.goldDeep }} />
            <input
              name="q"
              placeholder="Hostel name or campus — Legon, KNUST, UCC…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
              style={{ color: MP.ink }}
            />
          </div>
          <div className="flex items-center gap-2 rounded-xl px-4 py-3 sm:w-44" style={{ background: MP.surfaceSoft }}>
            <MapPin className="h-4 w-4 shrink-0" style={{ color: MP.goldDeep }} />
            <input
              name="city"
              placeholder="City"
              className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
              style={{ color: MP.ink }}
            />
          </div>
          <button
            type="submit"
            className="shrink-0 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
            style={{ background: MP.green }}
          >
            Search
          </button>
        </form>
      ) : (
        <div className="flex flex-col items-center gap-3 py-6 text-center sm:flex-row sm:justify-between sm:gap-4 sm:py-5 sm:text-left">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: MP.surfaceSoft }}>
              <Sparkles className="h-[18px] w-[18px]" style={{ color: MP.goldDeep }} />
            </span>
            <div>
              <p className="text-sm font-semibold" style={{ color: MP.ink }}>{activeTab.label} is on the way</p>
              <p className="text-[13px]" style={{ color: MP.textSecondary }}>We're expanding beyond hostels — check back soon.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActive('hostels')}
            className="shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
            style={{ background: MP.green }}
          >
            Browse hostels
          </button>
        </div>
      )}
    </div>
  )
}
