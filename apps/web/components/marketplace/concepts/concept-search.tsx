'use client'

import { useRef, useState, type KeyboardEvent } from 'react'
import { MapPin, Search } from 'lucide-react'
import { NAME_FIELD, SEARCH_BUSINESS_TYPE, nextTabIndex, type TabKey } from '@/lib/marketplace-search'

/**
 * Design concept (not live): the hero search in two layouts. Same form
 * contract as components/marketplace/hero-search.tsx — GET /browse with
 * q, city and type — so it searches exactly what the live one does.
 */

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'hostels', label: 'Student hostels' },
  { key: 'hotels', label: 'Hotels' },
  { key: 'apartments', label: 'Apartments' },
]

export function ConceptSearch({
  layout,
  destinations,
}: {
  /** 'bar': one row on desktop. 'stacked': fields under each other. */
  layout: 'bar' | 'stacked'
  destinations: string[]
}) {
  const [active, setActive] = useState<TabKey>('hostels')
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const type = SEARCH_BUSINESS_TYPE[active]
  const nameField = NAME_FIELD[active]

  function onTabKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = nextTabIndex(index, e.key, TABS.length)
    if (next === null) return
    e.preventDefault()
    tabRefs.current[next]?.focus()
    setActive(TABS[next].key)
  }

  const field =
    'flex min-h-[56px] cursor-text items-center gap-3 rounded-lg px-3.5 transition-colors focus-within:bg-white focus-within:ring-2 focus-within:ring-bd-teal/25'

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
              aria-selected={isActive}
              aria-controls={`concept-search-${layout}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActive(tab.key)}
              onKeyDown={(e) => onTabKeyDown(e, i)}
              className={[
                'bd-focus min-h-[40px] rounded-full px-4 text-[14px] font-semibold transition-colors',
                isActive ? 'bg-bd-ink text-white' : 'text-bd-ink/75 hover:bg-bd-ink/5 hover:text-bd-ink',
              ].join(' ')}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <form
        id={`concept-search-${layout}`}
        role="search"
        action="/browse"
        method="get"
        aria-label={`Search ${TABS.find((t) => t.key === active)!.label.toLowerCase()}`}
        className={[
          'mt-3 rounded-xl border border-bd-ink/15 bg-white p-1.5 shadow-[0_1px_2px_rgba(18,36,41,0.05),0_10px_30px_-18px_rgba(18,36,41,0.25)]',
          layout === 'bar' ? 'grid gap-1 md:grid-cols-[1fr_1px_1fr_auto] md:items-center' : 'grid gap-1',
        ].join(' ')}
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
              className="w-full bg-transparent text-[15px] text-bd-ink outline-none placeholder:text-bd-slate/80"
            />
          </span>
        </label>
        {layout === 'bar'
          ? <span className="hidden h-8 bg-bd-ink/10 md:block" aria-hidden="true" />
          : <span className="mx-3 h-px bg-bd-ink/10" aria-hidden="true" />}
        <label className={field}>
          <MapPin className="h-5 w-5 shrink-0 text-bd-slate" aria-hidden="true" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[12px] font-semibold text-bd-ink">Town or city</span>
            <input
              name="city"
              placeholder="Anywhere in Ghana"
              autoComplete="address-level2"
              enterKeyHint="search"
              list={`concept-towns-${layout}`}
              className="w-full bg-transparent text-[15px] text-bd-ink outline-none placeholder:text-bd-slate/80"
            />
          </span>
        </label>
        <datalist id={`concept-towns-${layout}`}>
          {destinations.map((d) => <option key={d} value={d} />)}
        </datalist>
        <button
          type="submit"
          className={[
            'bd-focus inline-flex min-h-[52px] items-center justify-center gap-2 rounded-lg px-7 text-[16px] font-semibold transition-colors',
            layout === 'bar'
              ? 'bg-bd-teal text-white hover:bg-bd-teal-900'
              : 'mt-1 bg-bd-amber text-bd-teal hover:bg-bd-amber-300',
          ].join(' ')}
        >
          <Search className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
          Search
        </button>
      </form>
    </div>
  )
}
