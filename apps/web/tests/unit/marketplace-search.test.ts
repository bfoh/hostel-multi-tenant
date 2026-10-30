/**
 * Homepage search (components/marketplace/hero-search.tsx): the tab each
 * category searches, the /browse URL a search builds, which input a chip
 * fills, and arrow-key movement across the category tabs.
 */
import { describe, expect, it } from 'vitest'
import {
  SEARCH_BUSINESS_TYPE,
  applyQuickLink,
  browseSearchHref,
  nextTabIndex,
  quickSearchHref,
} from '@/components/marketplace/hero-search'

describe('category tabs', () => {
  it('search the matching vertical', () => {
    expect(SEARCH_BUSINESS_TYPE).toEqual({ hostels: 'hostel', hotels: 'hotel', apartments: 'apartment' })
  })

  it('move with the arrow keys and wrap at either end', () => {
    expect(nextTabIndex(0, 'ArrowRight', 3)).toBe(1)
    expect(nextTabIndex(2, 'ArrowRight', 3)).toBe(0)
    expect(nextTabIndex(0, 'ArrowLeft', 3)).toBe(2)
    expect(nextTabIndex(1, 'Home', 3)).toBe(0)
    expect(nextTabIndex(0, 'End', 3)).toBe(2)
  })

  it('ignore other keys so Tab and Enter behave normally', () => {
    for (const key of ['Tab', 'Enter', ' ', 'ArrowDown', 'a']) expect(nextTabIndex(1, key, 3)).toBeNull()
  })
})

describe('browseSearchHref', () => {
  it('keeps the vertical for hotels and apartments', () => {
    expect(browseSearchHref({ type: 'hotel', q: 'Royal', city: 'Accra' })).toBe('/browse?q=Royal&city=Accra&type=hotel')
    expect(browseSearchHref({ type: 'apartment', city: 'Osu' })).toBe('/browse?city=Osu&type=apartment')
  })

  it('trims input and drops empty fields', () => {
    expect(browseSearchHref({ type: 'hostel', q: '  Legon ', city: '   ' })).toBe('/browse?q=Legon')
    expect(browseSearchHref({ type: 'hostel', q: '', city: '' })).toBe('/browse')
    expect(browseSearchHref({ type: 'hotel' })).toBe('/browse?type=hotel')
  })
})

describe('popular chips', () => {
  it('fill the input /browse filters on and clear the other one', () => {
    expect(applyQuickLink({ label: 'KNUST', field: 'q' })).toEqual({ q: 'KNUST', city: '' })
    expect(applyQuickLink({ label: 'Kumasi', field: 'city' })).toEqual({ q: '', city: 'Kumasi' })
  })

  it('link to the same search a click runs', () => {
    const link = { label: 'Cape Coast', field: 'city' } as const
    expect(quickSearchHref(link, 'hotel')).toBe(browseSearchHref({ type: 'hotel', ...applyQuickLink(link) }))
  })
})
