/**
 * Search rules shared by the homepage hero search (a Client Component) and
 * the server-rendered homepage and /browse. Kept out of the 'use client'
 * module: a value imported from one into a Server Component arrives as a
 * client reference, not the value (the Featured section once read
 * SEARCH_BUSINESS_TYPE as undefined that way).
 *
 * /browse filters on the property name (?q=) and the town (?city=) only —
 * there is no date or guest search because the directory doesn't filter on
 * availability or capacity; dates and guests are chosen on each property's
 * own booking page.
 */

export type TabKey = 'hostels' | 'hotels' | 'apartments'
export type Vertical = 'hostel' | 'hotel' | 'apartment'

/** Each tab maps to its own marketplace vertical — see MarketplaceVertical. */
export const SEARCH_BUSINESS_TYPE: Record<TabKey, Vertical> = {
  hostels: 'hostel',
  hotels: 'hotel',
  apartments: 'apartment',
}

/** Label and placeholder for the name field (?q=, matched against the
 *  property name) on each tab. */
export const NAME_FIELD: Record<TabKey, { label: string; placeholder: string }> = {
  hostels: { label: 'Hostel name', placeholder: 'Search by name' },
  hotels: { label: 'Hotel or guesthouse', placeholder: 'Search by name' },
  apartments: { label: 'Apartment or short-let', placeholder: 'Search by name' },
}

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

/** /browse URL for one town in a vertical — the homepage's popular
 *  searches and town tiles. */
export function townSearchHref(town: string, type?: Vertical): string {
  return browseSearchHref({ type, city: town })
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
