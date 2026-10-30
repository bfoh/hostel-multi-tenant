'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BedDouble, Building2, Home, Search, MapPin, Loader2 } from 'lucide-react'

/**
 * Vertical-tabbed hero search for the three live marketplace verticals.
 * Hotels and apartments both live under the tenants.business_type='hotel'
 * pool (that column also drives subdomain routing, so it stays binary), but
 * are split into separate marketplace listings via tenants.accommodation_type
 * — see lib/directory.ts's MarketplaceVertical.
 *
 * The search fields are the ones /browse actually filters on: property name
 * (?q=) and town (?city=). There is no date or guest search because the
 * directory doesn't filter on availability or capacity — dates and guests
 * are chosen on each property's own booking page.
 */

export type TabKey = 'hostels' | 'hotels' | 'apartments'

const TABS: Array<{ key: TabKey; label: string; icon: typeof BedDouble }> = [
  { key: 'hostels', label: 'Hostels', icon: BedDouble },
  { key: 'hotels', label: 'Hotels', icon: Building2 },
  { key: 'apartments', label: 'Apartments', icon: Home },
]

/** Each tab maps to its own marketplace vertical — see MarketplaceVertical. */
export const SEARCH_BUSINESS_TYPE: Record<TabKey, 'hostel' | 'hotel' | 'apartment'> = {
  hostels: 'hostel',
  hotels: 'hotel',
  apartments: 'apartment',
}

/** Label + placeholder for the name field (?q=, matched against the
 *  property name) on each tab. */
const NAME_FIELD: Record<TabKey, { label: string; placeholder: string }> = {
  hostels: { label: 'Hostel or campus', placeholder: 'e.g. Legon, KNUST, UCC' },
  hotels: { label: 'Hotel or guesthouse', placeholder: 'Search by name' },
  apartments: { label: 'Apartment or short-let', placeholder: 'Search by name' },
}

/**
 * Quick-search chips. Hostels keeps the original campus names; hotels and
 * apartments get Ghana destination names instead, since "Legon"/"KNUST" as
 * a hotel search suggestion would make no sense.
 *
 * Each chip fills the same field a visitor would type it into: campuses go
 * to the name/campus field (?q=, matched against the property name) and
 * towns to the destination field (?city=, matched against address_city) —
 * a town sent as ?q= only finds properties with the town in their name.
 */
export type QuickLink = { label: string; field: 'q' | 'city' }

const DESTINATIONS: QuickLink[] = ['Accra', 'Kumasi', 'Cape Coast', 'Elmina', 'Aburi']
  .map((label) => ({ label, field: 'city' as const }))

const QUICK_LINKS: Record<TabKey, QuickLink[]> = {
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

type Vertical = 'hostel' | 'hotel' | 'apartment'

/** /browse URL for a search. Empty fields are dropped; hostel is /browse's
 *  default type, so it is left out. */
export function browseSearchHref({ type, q, city }: { type?: Vertical; q?: string; city?: string }): string {
  const params = new URLSearchParams()
  if (q?.trim()) params.set('q', q.trim())
  if (city?.trim()) params.set('city', city.trim())
  if (type && type !== 'hostel') params.set('type', type)
  const qs = params.toString()
  return qs ? `/browse?${qs}` : '/browse'
}

/** /browse URL for a quick-search chip on its own (the link's href, used
 *  without JavaScript). */
export function quickSearchHref(link: QuickLink, type?: Vertical): string {
  return browseSearchHref({ type, [link.field]: link.label })
}

/** The search fields after a chip is applied: the chip's value goes into
 *  its own field and the other is cleared, so a click runs the same search
 *  as the chip's link (opened in a new tab, or without JavaScript). */
export function applyQuickLink(link: QuickLink): { q: string; city: string } {
  return { q: '', city: '', [link.field]: link.label }
}

/** Tab index after an arrow/Home/End key press in the tab list, or null for
 *  keys the tab list doesn't handle. Arrows wrap around. */
export function nextTabIndex(current: number, key: string, count: number): number | null {
  switch (key) {
    case 'ArrowRight': return (current + 1) % count
    case 'ArrowLeft':  return (current - 1 + count) % count
    case 'Home':       return 0
    case 'End':        return count - 1
    default:           return null
  }
}

export function HeroSearch({
  initialTab,
  destinations = [],
}: {
  initialTab?: TabKey
  /** Towns that have listed properties, offered as suggestions in the
   *  destination field. */
  destinations?: string[]
} = {}) {
  const router = useRouter()
  const [active, setActive] = useState<TabKey>(initialTab ?? 'hostels')
  const [fields, setFields] = useState({ q: '', city: '' })
  const [pending, setPending] = useState(false)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const type = SEARCH_BUSINESS_TYPE[active]
  const nameField = NAME_FIELD[active]
  const activeLabel = TABS.find((t) => t.key === active)!.label

  // Back/forward between ?tab= URLs re-renders the page with a new
  // initialTab; keep the tabs in step with it (typed text is kept).
  useEffect(() => {
    if (initialTab) setActive(initialTab)
  }, [initialTab])

  // A native GET submit can come back from the browser's back/forward cache
  // with the spinner still showing.
  useEffect(() => {
    const reset = () => setPending(false)
    window.addEventListener('pageshow', reset)
    return () => window.removeEventListener('pageshow', reset)
  }, [])

  // Tab clicks also update ?tab= on the current URL so the homepage's
  // server-rendered Featured section (which can't see this component's
  // client state directly) can react to the selection too.
  function selectTab(key: TabKey) {
    if (key === active) return
    setActive(key)
    router.push(`/?tab=${key}`, { scroll: false })
  }

  // Arrow keys move focus between tabs; Enter/Space (the button's own click)
  // selects. Selection navigates, so it doesn't follow focus.
  function onTabKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = nextTabIndex(index, e.key, TABS.length)
    if (next === null) return
    e.preventDefault()
    tabRefs.current[next]?.focus()
  }

  function onQuickLink(e: MouseEvent<HTMLAnchorElement>, link: QuickLink) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    setFields(applyQuickLink(link))
    setPending(true)
    router.push(quickSearchHref(link, type))
  }

  return (
    <div
      className="mp-reveal mx-auto rounded-[24px] border border-bd-teal/10 bg-white p-2.5 shadow-[0_24px_48px_-28px_rgba(11,31,35,0.45)] sm:rounded-[28px] sm:p-4"
      style={{ animationDelay: '180ms' }}
    >
      <div role="tablist" aria-label="Type of stay" className="grid grid-cols-3 gap-1 rounded-2xl bg-bd-ivory p-1">
        {TABS.map((tab, i) => {
          const Icon = tab.icon
          const isActive = tab.key === active
          return (
            <button
              key={tab.key}
              ref={(el) => { tabRefs.current[i] = el }}
              type="button"
              role="tab"
              id={`stay-tab-${tab.key}`}
              aria-selected={isActive}
              aria-controls="stay-search-panel"
              tabIndex={isActive ? 0 : -1}
              onClick={() => selectTab(tab.key)}
              onKeyDown={(e) => onTabKeyDown(e, i)}
              className={[
                'bd-focus flex min-h-[48px] min-w-0 flex-col items-center justify-center gap-1 whitespace-nowrap rounded-xl px-1 py-1.5 text-[clamp(12px,3.6vw,14px)] font-semibold transition-colors sm:flex-row sm:gap-2 sm:py-2',
                isActive
                  ? 'bg-bd-teal text-bd-ivory shadow-sm'
                  : 'text-bd-slate hover:bg-white hover:text-bd-teal',
              ].join(' ')}
            >
              <Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-bd-amber' : ''}`} strokeWidth={isActive ? 2.2 : 1.8} aria-hidden="true" />
              {tab.label}
            </button>
          )
        })}
      </div>

      <div role="tabpanel" id="stay-search-panel" aria-labelledby={`stay-tab-${active}`}>
        <form
          action="/browse"
          method="get"
          role="search"
          aria-label={`Search ${activeLabel.toLowerCase()}`}
          onSubmit={() => setPending(true)}
          className="mt-2.5 grid gap-2.5 sm:mt-3 sm:grid-cols-[1fr_auto] sm:gap-3"
        >
          {type !== 'hostel' && <input type="hidden" name="type" value={type} />}
          <div className="grid divide-y divide-bd-teal/10 overflow-hidden rounded-2xl border border-bd-teal/15 bg-bd-ivory-50 sm:grid-cols-[1.2fr_1fr] sm:divide-x sm:divide-y-0">
            <label className="flex cursor-text items-center gap-3 px-4 py-2.5 transition-colors focus-within:bg-white">
              <Search className="h-5 w-5 shrink-0 text-bd-teal/70" aria-hidden="true" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-bd-slate">{nameField.label}</span>
                <input
                  name="q"
                  value={fields.q}
                  onChange={(e) => setFields((f) => ({ ...f, q: e.target.value }))}
                  placeholder={nameField.placeholder}
                  autoComplete="off"
                  enterKeyHint="search"
                  className="w-full bg-transparent text-[16px] text-bd-teal outline-none placeholder:text-bd-slate/70"
                />
              </span>
            </label>
            <label className="flex cursor-text items-center gap-3 px-4 py-2.5 transition-colors focus-within:bg-white">
              <MapPin className="h-5 w-5 shrink-0 text-bd-teal/70" aria-hidden="true" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-bd-slate">Destination</span>
                <input
                  name="city"
                  value={fields.city}
                  onChange={(e) => setFields((f) => ({ ...f, city: e.target.value }))}
                  placeholder="City or town"
                  autoComplete="address-level2"
                  enterKeyHint="search"
                  list={destinations.length > 0 ? 'stay-destinations' : undefined}
                  className="w-full bg-transparent text-[16px] text-bd-teal outline-none placeholder:text-bd-slate/70"
                />
              </span>
            </label>
          </div>
          {destinations.length > 0 && (
            <datalist id="stay-destinations">
              {destinations.map((d) => <option key={d} value={d} />)}
            </datalist>
          )}
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="bd-focus inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-bd-amber px-8 text-[16px] font-bold text-bd-teal shadow-[0_10px_24px_-14px_rgba(227,162,63,0.9)] transition-colors duration-200 hover:bg-bd-amber-600 disabled:cursor-wait disabled:opacity-80"
          >
            {pending
              ? <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              : <Search className="h-5 w-5" strokeWidth={2.4} aria-hidden="true" />}
            {pending ? 'Searching…' : 'Search'}
          </button>
        </form>

        <div className="mt-2.5 flex items-center gap-2 sm:mt-3">
          <span id="popular-label" className="shrink-0 pl-1 text-[12px] font-semibold text-bd-slate">Popular</span>
          <ul
            aria-labelledby="popular-label"
            className="mp-no-scrollbar -my-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-1 pr-1 [mask-image:linear-gradient(to_right,black_calc(100%-24px),transparent)] sm:flex-wrap sm:overflow-visible sm:[mask-image:none]"
          >
            {QUICK_LINKS[active].map((link) => (
              <li key={link.label} className="shrink-0">
                <Link
                  href={quickSearchHref(link, type)}
                  onClick={(e) => onQuickLink(e, link)}
                  className="bd-focus inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-bd-teal/15 bg-white px-3 text-[13px] font-medium text-bd-teal transition-colors hover:border-bd-teal hover:bg-bd-teal hover:text-bd-ivory"
                >
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
