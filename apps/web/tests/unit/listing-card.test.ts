/**
 * Marketplace listing card, price and the booking page's room preselect.
 * Rendered to static HTML (no DOM needed): what a visitor sees with and
 * without owner photos, that every price carries its billing unit, where
 * the card links, and that a ?room= link only skips to the details step
 * for a room type that can actually be booked.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { DirectoryListing } from '@/lib/directory'
import { ListingCard } from '@/components/public/listing-card'
import { ListingListRow } from '@/components/public/listing-list-row'
import { ListingCover, NoPhotoTile } from '@/components/public/listing-photo'
import { Price } from '@/components/public/price'
import { preselectedCategory } from '@/components/public/booking-flow'

const listing: DirectoryListing = {
  slug: 'adenta-heights-hostel',
  name: 'Adenta Heights Hostel',
  tagline: null,
  logo_url: null,
  primary_color: null,
  address_city: 'Accra',
  address_region: 'Greater Accra',
  business_type: 'hostel',
  accommodation_type: 'hotel',
  from_rate: 550000,
  from_rate_unit: 'semester',
  category_count: 2,
  hero_image_url: null,
  created_at: '2026-01-01T00:00:00Z',
}

const text = (html: string) => html.replace(/<[^>]+>/g, '')

describe('Price', () => {
  it('always shows the billing unit', () => {
    for (const unit of ['night', 'week', 'month', 'semester']) {
      const html = renderToStaticMarkup(createElement(Price, { amount: 550000, unit, from: true }))
      expect(text(html)).toContain(`/  per ${unit}`)
      expect(text(html)).toMatch(/^From GH₵/)
    }
  })
})

describe('ListingCard', () => {
  it('links to the property page', () => {
    const html = renderToStaticMarkup(createElement(ListingCard, { listing }))
    expect(html).toContain('href="/listing/adenta-heights-hostel"')
  })

  it('shows the stay type, room count, location and unit price', () => {
    const t = text(renderToStaticMarkup(createElement(ListingCard, { listing })))
    expect(t).toContain('Student hostel · 2 room types')
    expect(t).toContain('Accra, Greater Accra')
    expect(t).toContain('per semester')
  })

  it('uses a designed cover, not a stock image, when there is no photo', () => {
    const html = renderToStaticMarkup(createElement(ListingCard, { listing }))
    expect(html).not.toContain('<img')
    expect(html).toContain('aria-label="Adenta Heights Hostel: no photos yet"')
    expect(text(html)).toContain('No photos yet')
    expect(text(html)).toContain('AH')
  })

  it('shows an all-caps name and a lowercase town in normal case', () => {
    const t = text(renderToStaticMarkup(createElement(ListingCard, {
      listing: { ...listing, name: 'KENTE HOUSE HOSTEL', address_city: 'accra' },
    })))
    expect(t).toContain('Kente House Hostel')
    expect(t).toContain('Accra, Greater Accra')
  })

  it("leads with the owner's photo when there is one", () => {
    const html = renderToStaticMarkup(createElement(ListingCard, { listing: { ...listing, hero_image_url: 'https://cdn.example/p.jpg' } }))
    expect(html).toContain('src="https://cdn.example/p.jpg"')
    expect(html).toContain('alt="Adenta Heights Hostel, Accra, Greater Accra"')
    expect(text(html)).not.toContain('No photos yet')
  })

  it('can switch to a compact row on phones', () => {
    const html = renderToStaticMarkup(createElement(ListingCard, { listing, rowOnPhone: true }))
    expect(html).toContain('w-24')
    expect(html).toContain('sm:flex-col')
    expect(renderToStaticMarkup(createElement(ListingCard, { listing }))).not.toContain('w-24')
  })

  it('labels apartments and hotels by their accommodation type', () => {
    const apt = text(renderToStaticMarkup(createElement(ListingCard, { listing: { ...listing, business_type: 'hotel', accommodation_type: 'apartment', category_count: 1 } })))
    expect(apt).toContain('Apartment · 1 room type')
  })
})

describe('ListingListRow', () => {
  it('links to the property page with the same photo fallback', () => {
    const html = renderToStaticMarkup(createElement(ListingListRow, { listing }))
    expect(html).toContain('href="/listing/adenta-heights-hostel"')
    expect(html).not.toContain('<img')
    expect(html).toContain('aria-label="Adenta Heights Hostel: no photos yet"')
  })
})

describe('ListingCover', () => {
  it('says there are no photos and can drop the note', () => {
    const html = renderToStaticMarkup(createElement(ListingCover, { name: 'Unity Court' }))
    expect(html).toContain('role="img"')
    expect(text(html)).toContain('UC')
    expect(text(html)).toContain('No photos yet')
    expect(text(renderToStaticMarkup(createElement(ListingCover, { name: 'Unity Court', note: false })))).not.toContain('No photos yet')
  })
})

describe('NoPhotoTile', () => {
  it('shows initials and an accessible label', () => {
    const html = renderToStaticMarkup(createElement(NoPhotoTile, { name: 'The Royal Avenue Suites' }))
    expect(html).toContain('role="img"')
    expect(text(html)).toContain('RA')
  })
})

describe('preselectedCategory', () => {
  const categories = [
    { id: 'c1', available: 1 },
    { id: 'c3', available: 0 },
  ]

  it('preselects a room type that has space', () => {
    expect(preselectedCategory(categories, 'c1')).toEqual({ id: 'c1', available: 1 })
  })

  it('stays on the room picker for a full, unknown or missing room', () => {
    expect(preselectedCategory(categories, 'c3')).toBeNull()
    expect(preselectedCategory(categories, 'other-tenant-room')).toBeNull()
    expect(preselectedCategory(categories, null)).toBeNull()
    expect(preselectedCategory(categories, undefined)).toBeNull()
  })
})
