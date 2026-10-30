/**
 * Display rules shared by the marketplace cards and the property page, so a
 * listing reads the same on the homepage, /browse and /listing/[slug].
 * Everything here formats data the property actually entered — nothing is
 * inferred or invented.
 */

/** "Student hostel" / "Hotel" / "Apartment" from tenants.business_type and
 *  tenants.accommodation_type (migration 131). */
export function stayTypeLabel(businessType: string, accommodationType?: string | null): string {
  if (businessType === 'hostel') return 'Student hostel'
  return accommodationType === 'apartment' ? 'Apartment' : 'Hotel'
}

/** /browse ?type= value for a listing — the vertical its search lives in. */
export function stayVertical(businessType: string, accommodationType?: string | null): 'hostel' | 'hotel' | 'apartment' {
  if (businessType === 'hostel') return 'hostel'
  return accommodationType === 'apartment' ? 'apartment' : 'hotel'
}

/** Up to two initials for the no-photo tile: "Adenta Heights Hostel" → "AH",
 *  ignoring a leading "The". */
export function listingInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => !/^the$/i.test(w) && /[\p{L}\p{N}]/u.test(w))
  return words.slice(0, 2).map((w) => w.match(/[\p{L}\p{N}]/u)![0].toUpperCase()).join('') || '?'
}

/**
 * Listings with a real photo first, otherwise in the order given (stable).
 * Used to pick the homepage's featured cards; /browse keeps the visitor's
 * chosen sort so properties without photos are never hidden.
 */
export function photosFirst<T extends { hero_image_url: string | null }>(listings: T[]): T[] {
  return [...listings.filter((l) => l.hero_image_url), ...listings.filter((l) => !l.hero_image_url)]
}

/** Who a room type holds. room_categories.capacity is beds per room for
 *  hostels and guests per room for hotels and apartments. */
export function capacityLabel(capacity: number | null | undefined, businessType: string): string | null {
  if (!capacity || capacity < 1) return null
  if (businessType === 'hostel') return capacity === 1 ? 'Single room' : `${capacity} per room`
  return capacity === 1 ? 'Sleeps 1' : `Sleeps up to ${capacity}`
}

export type AvailabilityStatus = { label: string; tone: 'available' | 'low' | 'full' }

/**
 * Bed availability for a hostel room type, from the same free-bed counts the
 * booking page uses (room_occupancy_v). Hotels and apartments return null:
 * their bookings are by date, so today's occupancy says nothing about the
 * guest's dates — those are checked on the booking page.
 */
export function bedAvailability(available: number, total: number, businessType: string): AvailabilityStatus | null {
  if (businessType !== 'hostel' || total <= 0) return null
  if (available <= 0) return { label: 'Fully booked', tone: 'full' }
  const label = `${available} bed${available === 1 ? '' : 's'} available`
  return { label, tone: available <= 2 ? 'low' : 'available' }
}
