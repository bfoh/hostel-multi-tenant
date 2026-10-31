/**
 * Marketplace display rules (lib/listing-display.ts, lib/amenity-icons.tsx):
 * stay-type labels, the no-photo tile's initials, photo-first ordering for
 * the homepage, room capacity and hostel bed availability, amenity labels.
 */
import { describe, expect, it } from 'vitest'
import {
  bedAvailability,
  capacityLabel,
  coverTone,
  displayName,
  displayPlace,
  listingInitials,
  listingLocation,
  photosFirst,
  stayTypeLabel,
  stayVertical,
  townsWithListings,
} from '@/lib/listing-display'
import { amenityLabel } from '@/lib/amenity-icons'

describe('stay type', () => {
  it('labels and routes each vertical', () => {
    expect(stayTypeLabel('hostel')).toBe('Student hostel')
    expect(stayTypeLabel('hotel', 'hotel')).toBe('Hotel')
    expect(stayTypeLabel('hotel', null)).toBe('Hotel')
    expect(stayTypeLabel('hotel', 'apartment')).toBe('Apartment')
    expect(stayVertical('hostel', 'apartment')).toBe('hostel')
    expect(stayVertical('hotel', 'apartment')).toBe('apartment')
    expect(stayVertical('hotel')).toBe('hotel')
  })
})

describe('listingInitials', () => {
  it('uses up to two initials and skips a leading "The"', () => {
    expect(listingInitials('Adenta Heights Hostel')).toBe('AH')
    expect(listingInitials('The Royal Avenue Suites')).toBe('RA')
    expect(listingInitials('acacia')).toBe('A')
    expect(listingInitials('  ')).toBe('?')
    expect(listingInitials('Osu & Co Lofts')).toBe('OC')
  })
})

describe('photosFirst', () => {
  it('moves listings with a photo first without dropping or reordering the rest', () => {
    const rows = [
      { id: 'a', hero_image_url: null },
      { id: 'b', hero_image_url: 'https://x/b.jpg' },
      { id: 'c', hero_image_url: null },
      { id: 'd', hero_image_url: 'https://x/d.jpg' },
    ]
    expect(photosFirst(rows).map((r) => r.id)).toEqual(['b', 'd', 'a', 'c'])
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('capacityLabel', () => {
  it('describes beds per room for hostels and guests for hotels and apartments', () => {
    expect(capacityLabel(1, 'hostel')).toBe('Single room')
    expect(capacityLabel(4, 'hostel')).toBe('4 per room')
    expect(capacityLabel(1, 'hotel')).toBe('Sleeps 1')
    expect(capacityLabel(3, 'hotel')).toBe('Sleeps up to 3')
  })

  it('shows nothing for a missing capacity', () => {
    expect(capacityLabel(0, 'hostel')).toBeNull()
    expect(capacityLabel(null, 'hotel')).toBeNull()
    expect(capacityLabel(undefined, 'hostel')).toBeNull()
  })
})

describe('bedAvailability', () => {
  it('reports free beds for hostels', () => {
    expect(bedAvailability(0, 8, 'hostel')).toEqual({ label: 'Fully booked', tone: 'full' })
    expect(bedAvailability(1, 8, 'hostel')).toEqual({ label: '1 bed available', tone: 'low' })
    expect(bedAvailability(2, 8, 'hostel')).toEqual({ label: '2 beds available', tone: 'low' })
    expect(bedAvailability(5, 8, 'hostel')).toEqual({ label: '5 beds available', tone: 'available' })
  })

  it('claims nothing for hotels, apartments or rooms with no beds set up', () => {
    expect(bedAvailability(3, 4, 'hotel')).toBeNull()
    expect(bedAvailability(0, 0, 'hostel')).toBeNull()
  })
})

describe('amenityLabel', () => {
  it('expands the older short keys', () => {
    expect(amenityLabel('wifi')).toBe('Wi-Fi')
    expect(amenityLabel('ac')).toBe('Air conditioning')
    expect(amenityLabel('water')).toBe('Running water')
    expect(amenityLabel('kitchen')).toBe('Kitchen access')
  })

  it('keeps labels the owner entered, capitalised', () => {
    expect(amenityLabel('Private bathroom')).toBe('Private bathroom')
    expect(amenityLabel('study desk')).toBe('Study desk')
    expect(amenityLabel(' Balcony ')).toBe('Balcony')
  })

  it('reads underscores in stored keys as spaces', () => {
    expect(amenityLabel('study_area')).toBe('Study area')
  })
})

describe('displayName', () => {
  it('title-cases names typed in capitals', () => {
    expect(displayName('KENTE HOUSE HOSTEL')).toBe('Kente House Hostel')
    expect(displayName('OFORI-ATTA LODGE')).toBe('Ofori-Atta Lodge')
    expect(displayName('HOUSE OF GRACE')).toBe('House of Grace')
    expect(displayName('THE ROYAL SUITES')).toBe('The Royal Suites')
  })

  it('keeps short capitalised words, which are usually acronyms', () => {
    expect(displayName('AMP HOSTEL')).toBe('AMP Hostel')
    expect(displayName('UCC ANNEX')).toBe('UCC Annex')
  })

  it('leaves names with any lowercase letters, and short names, as typed', () => {
    expect(displayName('Sunrise apartments')).toBe('Sunrise apartments')
    expect(displayName('McCarthy Hall')).toBe('McCarthy Hall')
    expect(displayName('  AMP ')).toBe('AMP')
  })
})

describe('displayPlace and listingLocation', () => {
  it('capitalise towns typed in lowercase or capitals', () => {
    expect(displayPlace('accra')).toBe('Accra')
    expect(displayPlace('cape coast')).toBe('Cape Coast')
    expect(displayPlace('KUMASI')).toBe('Kumasi')
    expect(displayPlace('East Legon')).toBe('East Legon')
    expect(displayPlace('  ')).toBeNull()
    expect(displayPlace(null)).toBeNull()
  })

  it('join whichever of town and region are set', () => {
    expect(listingLocation('accra', 'Greater Accra')).toBe('Accra, Greater Accra')
    expect(listingLocation(null, 'Central')).toBe('Central')
    expect(listingLocation(null, null)).toBe('')
  })
})

describe('townsWithListings', () => {
  it('merges spellings, counts listings and puts the busiest town first', () => {
    const towns = townsWithListings([
      { address_city: 'Accra', address_region: 'Greater Accra' },
      { address_city: 'Kumasi', address_region: 'Ashanti' },
      { address_city: 'accra', address_region: 'Greater Accra' },
      { address_city: 'Winneba', address_region: 'Central' },
      { address_city: null, address_region: 'Central' },
    ])
    expect(towns).toEqual([
      { town: 'Accra', region: 'Greater Accra', count: 2 },
      { town: 'Kumasi', region: 'Ashanti', count: 1 },
      { town: 'Winneba', region: 'Central', count: 1 },
    ])
  })
})

describe('coverTone', () => {
  it('gives a property the same colours every time', () => {
    expect(coverTone('unity-court')).toBe(coverTone('unity-court'))
  })
})
