/**
 * Marketplace display rules (lib/listing-display.ts, lib/amenity-icons.tsx):
 * stay-type labels, the no-photo tile's initials, photo-first ordering for
 * the homepage, room capacity and hostel bed availability, amenity labels.
 */
import { describe, expect, it } from 'vitest'
import {
  bedAvailability,
  capacityLabel,
  listingInitials,
  photosFirst,
  stayTypeLabel,
  stayVertical,
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
})
