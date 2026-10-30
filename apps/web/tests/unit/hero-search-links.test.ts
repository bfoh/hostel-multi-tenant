import { describe, expect, it } from 'vitest'
import { quickSearchHref } from '@/components/marketplace/hero-search'

// /browse matches ?q= against the property name and ?city= against
// address_city (lib/directory.ts), so a destination chip must use ?city=.
describe('quickSearchHref', () => {
  it('sends destination chips to the city field with the vertical type', () => {
    expect(quickSearchHref({ label: 'Accra', field: 'city' }, 'hotel')).toBe('/browse?city=Accra&type=hotel')
    expect(quickSearchHref({ label: 'Cape Coast', field: 'city' }, 'apartment')).toBe('/browse?city=Cape+Coast&type=apartment')
  })

  it('sends campus chips to the name/campus field', () => {
    expect(quickSearchHref({ label: 'KNUST', field: 'q' }, 'hostel')).toBe('/browse?q=KNUST')
  })

  it('omits the default hostel type', () => {
    expect(quickSearchHref({ label: 'Kumasi', field: 'city' }, 'hostel')).toBe('/browse?city=Kumasi')
    expect(quickSearchHref({ label: 'Kumasi', field: 'city' })).toBe('/browse?city=Kumasi')
  })
})
