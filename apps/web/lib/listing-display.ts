/**
 * Display rules shared by the marketplace cards and the property page, so a
 * listing reads the same on the homepage, /browse and /listing/[slug].
 * Everything here formats data the property actually entered — nothing is
 * inferred or invented.
 */

const SMALL_WORDS = new Set(['a', 'an', 'and', 'at', 'by', 'for', 'in', 'of', 'on', 'the', 'to'])

/**
 * A property name as owners type it, except ALL-CAPS names ("KENTE HOUSE
 * HOSTEL"), which read as shouting beside the others: those are shown in
 * title case. Two- and three-letter words stay as typed, since they are
 * usually acronyms ("AMP", "UCC"), apart from small words like "of".
 * Names with any lowercase letter are left exactly as entered.
 */
export function displayName(name: string): string {
  const trimmed = name.trim()
  const letters = trimmed.replace(/[^\p{L}]/gu, '')
  if (letters.length < 4 || letters !== letters.toUpperCase()) return trimmed
  return trimmed.split(/\s+/).map((word, i) => {
    const lower = word.toLowerCase()
    if (i > 0 && SMALL_WORDS.has(lower)) return lower
    if (/^\p{L}{2,3}$/u.test(word) && !SMALL_WORDS.has(lower)) return word
    return lower.replace(/(^|-)(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase())
  }).join(' ')
}

/** A town or region as typed, capitalised when it was typed all in
 *  lowercase ("accra" → "Accra") and title-cased when typed in capitals. */
export function displayPlace(place: string | null | undefined): string | null {
  const trimmed = place?.trim()
  if (!trimmed) return null
  if (trimmed === trimmed.toLowerCase()) {
    return trimmed.replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase())
  }
  return displayName(trimmed)
}

/** "Madina, Greater Accra" — whichever of town and region are set. */
export function listingLocation(city: string | null | undefined, region: string | null | undefined): string {
  return [displayPlace(city), displayPlace(region)].filter(Boolean).join(', ')
}

/**
 * Towns that have listings, most listings first (then A–Z), merging
 * spellings that differ only in case ("Accra" and "accra"). Drives the
 * homepage's popular searches and town tiles, so every link finds at least
 * one property.
 */
export function townsWithListings(
  listings: Array<{ address_city: string | null; address_region: string | null }>,
): Array<{ town: string; region: string | null; count: number }> {
  const byKey = new Map<string, { town: string; region: string | null; count: number }>()
  for (const l of listings) {
    const town = displayPlace(l.address_city)
    if (!town) continue
    const key = town.toLowerCase()
    const entry = byKey.get(key)
    if (entry) entry.count += 1
    else byKey.set(key, { town, region: displayPlace(l.address_region), count: 1 })
  }
  return [...byKey.values()].sort((a, b) => b.count - a.count || a.town.localeCompare(b.town))
}

/** Colour pairs for the cover of a listing with no photos. */
export const COVER_TONES = [
  { bg: '#E9F1F1', fg: '#2A5A61' },
  { bg: '#F2ECE1', fg: '#6E5634' },
  { bg: '#E7EFE8', fg: '#3B5E46' },
  { bg: '#F5E8E2', fg: '#8A4A38' },
  { bg: '#E8EDF2', fg: '#38506A' },
] as const

/** The same cover colours for a property everywhere it appears. */
export function coverTone(key: string): (typeof COVER_TONES)[number] {
  let hash = 0
  for (const ch of key) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0
  return COVER_TONES[hash % COVER_TONES.length]
}

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
