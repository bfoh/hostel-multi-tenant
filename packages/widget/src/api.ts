/* ── Public widget API client ─────────────────────────────────────────── */

export interface RoomCategory {
  id: string
  name: string
  type: string
  base_rate: number       // pesewas
  rate_unit: string
  capacity: number
  amenities: string[]
  description: string | null
  available_count: number
}

export interface BookingPayload {
  hostel_slug: string
  category_id: string
  check_in_date: string
  check_out_date: string | null
  first_name: string
  last_name: string
  email: string
  phone: string
  student_id: string | null
}

export interface BookingResult {
  booking_id: string
  booking_ref: string
  amount: number          // pesewas
  paystack_ref: string | null
}

let _baseUrl = ''

export function setBaseUrl(url: string) {
  _baseUrl = url.replace(/\/$/, '')
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${_baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? 'API error')
  }
  return res.json()
}

export function getAvailableRooms(slug: string): Promise<RoomCategory[]> {
  return apiFetch(`/api/widget/${encodeURIComponent(slug)}/rooms`)
}

export function createBooking(slug: string, payload: Omit<BookingPayload, 'hostel_slug'>): Promise<BookingResult> {
  return apiFetch(`/api/widget/${encodeURIComponent(slug)}/book`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
