import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  bookingOr: vi.fn(),
  createTenantAdminClient: vi.fn(),
  getServerTenantId: vi.fn(),
}))

vi.mock('@/lib/auth/tenant', () => ({
  getServerTenantId: mocks.getServerTenantId,
}))

vi.mock('@/lib/supabase/tenant-admin', () => ({
  createTenantAdminClient: mocks.createTenantAdminClient,
}))

const { getBookingsPage } = await import('@/lib/data/bookings')

function buildSupabaseMock() {
  let occupantQuery = 0

  const booking = {
    id: 'booking-francis',
    booking_ref: 'ABR-2026-417500',
    status: 'pending_payment',
    payment_status: 'unpaid',
    source: 'walk_in',
    group_id: null,
    check_in_date: '2026-08-24',
    check_out_date: '2026-12-21',
    final_amount: 550000,
    paid_amount: 0,
    created_at: '2026-08-24T08:00:00Z',
    occupant: { id: 'occupant-francis', first_name: 'Francis', last_name: 'Otoo' },
    room: { id: 'room-029', room_number: '029', block: 'A' },
  }

  const bookingsBuilder: Record<string, any> = {}
  bookingsBuilder.select = vi.fn(() => bookingsBuilder)
  bookingsBuilder.eq = vi.fn(() => bookingsBuilder)
  bookingsBuilder.order = vi.fn(() => bookingsBuilder)
  bookingsBuilder.gte = vi.fn(() => bookingsBuilder)
  bookingsBuilder.lte = vi.fn(() => bookingsBuilder)
  bookingsBuilder.or = vi.fn((filter: string) => {
    mocks.bookingOr(filter)
    return bookingsBuilder
  })
  bookingsBuilder.range = vi.fn(async () => ({ data: [booking], error: null, count: 1 }))

  return {
    from: vi.fn((table: string) => {
      if (table === 'occupants') {
        const termIndex = occupantQuery++
        return {
          select: vi.fn(() => ({
            or: vi.fn(async () => ({
              // Both the "Francis" and "Otoo" term queries resolve to the
              // same occupant, proving the token intersection behavior.
              data: termIndex < 2 ? [{ id: 'occupant-francis' }] : [],
              error: null,
            })),
          })),
        }
      }

      if (table === 'rooms') {
        return {
          select: vi.fn(() => ({
            or: vi.fn(async () => ({ data: [], error: null })),
          })),
        }
      }

      if (table === 'bookings') return bookingsBuilder
      throw new Error(`Unexpected table: ${table}`)
    }),
  }
}

describe('getBookingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getServerTenantId.mockResolvedValue('tenant-1')
    mocks.createTenantAdminClient.mockReturnValue(buildSupabaseMock())
  })

  it('searches a full name across separate occupant name fields before paging bookings', async () => {
    const result = await getBookingsPage({ search: 'Francis Otoo' })

    expect(result.total).toBe(1)
    expect(result.bookings[0]?.booking_ref).toBe('ABR-2026-417500')
    expect(mocks.bookingOr).toHaveBeenCalledWith(
      expect.stringContaining('occupant_id.in.(occupant-francis)'),
    )
  })
})
