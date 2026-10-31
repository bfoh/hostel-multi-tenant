'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Search, MapPin, Loader2 } from 'lucide-react'
import { NAME_FIELD, SEARCH_BUSINESS_TYPE, nextTabIndex, type TabKey } from '@/lib/marketplace-search'

/**
 * Tabbed hero search for the three live marketplace verticals. Hotels and
 * apartments both live under the tenants.business_type='hotel' pool (that
 * column also drives subdomain routing, so it stays binary), but are split
 * into separate marketplace listings via tenants.accommodation_type — see
 * lib/directory.ts's MarketplaceVertical. The fields are the ones /browse
 * filters on (see lib/marketplace-search.ts): a property name and a town.
 * One row on wide screens, stacked on phones.
 */

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'hostels', label: 'Student hostels' },
  { key: 'hotels', label: 'Hotels' },
  { key: 'apartments', label: 'Apartments' },
]

export function HeroSearch({
  initialTab,
  destinations = [],
}: {
  initialTab?: TabKey
  /** Towns that have listed properties, offered as suggestions in the
   *  town field. */
  destinations?: string[]
} = {}) {
  const router = useRouter()
  const [active, setActive] = useState<TabKey>(initialTab ?? 'hostels')
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
  // server-rendered sections (which can't see this component's client
  // state directly) follow the selection too.
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

  const field =
    'flex min-h-[60px] cursor-text items-center gap-3 rounded-lg px-3.5 transition-colors hover:bg-bd-mist focus-within:bg-white focus-within:ring-2 focus-within:ring-bd-teal/30'

  return (
    <div>
      <div role="tablist" aria-label="Type of stay" className="flex flex-wrap gap-1.5">
        {TABS.map((tab, i) => {
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
                'bd-focus min-h-[44px] whitespace-nowrap rounded-full px-4 text-[14px] font-semibold transition-colors',
                isActive ? 'bg-bd-ink text-white' : 'text-bd-ink/75 hover:bg-bd-ink/5 hover:text-bd-ink',
              ].join(' ')}
            >
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
          className="mt-3 grid gap-1 rounded-xl border border-bd-ink/15 bg-white p-1.5 shadow-[0_1px_2px_rgba(18,36,41,0.05),0_10px_30px_-18px_rgba(18,36,41,0.25)] md:grid-cols-[1fr_1px_1fr_auto] md:items-center"
        >
          {type !== 'hostel' && <input type="hidden" name="type" value={type} />}
          <label className={field}>
            <Search className="h-5 w-5 shrink-0 text-bd-slate" aria-hidden="true" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[12px] font-semibold text-bd-ink">{nameField.label}</span>
              <input
                name="q"
                placeholder={nameField.placeholder}
                autoComplete="off"
                enterKeyHint="search"
                className="w-full bg-transparent text-[16px] text-bd-ink outline-none placeholder:text-bd-slate/80"
              />
            </span>
          </label>
          <span className="mx-3 h-px bg-bd-ink/10 md:mx-0 md:h-8 md:w-px" aria-hidden="true" />
          <label className={field}>
            <MapPin className="h-5 w-5 shrink-0 text-bd-slate" aria-hidden="true" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[12px] font-semibold text-bd-ink">Town or city</span>
              <input
                name="city"
                placeholder="Anywhere in Ghana"
                autoComplete="address-level2"
                enterKeyHint="search"
                list={destinations.length > 0 ? 'stay-destinations' : undefined}
                className="w-full bg-transparent text-[16px] text-bd-ink outline-none placeholder:text-bd-slate/80"
              />
            </span>
          </label>
          {destinations.length > 0 && (
            <datalist id="stay-destinations">
              {destinations.map((d) => <option key={d} value={d} />)}
            </datalist>
          )}
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="bd-focus inline-flex min-h-[56px] items-center justify-center gap-2 rounded-lg bg-bd-teal px-8 text-[16px] font-semibold text-white transition-colors duration-200 hover:bg-bd-teal-900 disabled:cursor-wait disabled:opacity-80"
          >
            {pending
              ? <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              : <Search className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />}
            {pending ? 'Searching…' : 'Search'}
          </button>
        </form>
      </div>
    </div>
  )
}
