/**
 * Unit tests for classifyDueBookings() (app/api/cron/checkin-checkout-reminder/route.ts)
 * — splits the already-due bookings the cron fetches into "due today" vs
 * "overdue" (staff already missed it) buckets.
 */
import { describe, expect, it } from 'vitest'
import { classifyDueBookings } from '@/app/api/cron/checkin-checkout-reminder/route'

const occ = (name: string) => ({ first_name: name, last_name: 'Guest', phone: '0244000000' })
const room = { room_number: '101', block: null }

describe('classifyDueBookings', () => {
  it('buckets an arrival checking in today as todayArrivals, not overdue', () => {
    const today = '2026-10-02'
    const { todayArrivals, overdueArrivals } = classifyDueBookings(
      [{ id: '1', booking_ref: 'A1', check_in_date: today, occupant: occ('Ama'), room }],
      [],
      today,
    )
    expect(todayArrivals).toHaveLength(1)
    expect(overdueArrivals).toHaveLength(0)
  })

  it('buckets an arrival with a past check_in_date as overdue, not today', () => {
    const today = '2026-10-02'
    const { todayArrivals, overdueArrivals } = classifyDueBookings(
      [{ id: '1', booking_ref: 'A1', check_in_date: '2026-10-01', occupant: occ('Ama'), room }],
      [],
      today,
    )
    expect(overdueArrivals).toHaveLength(1)
    expect(todayArrivals).toHaveLength(0)
  })

  it('buckets a checked-in booking past its check_out_date as an overdue departure', () => {
    const today = '2026-10-02'
    const { todayDepartures, overdueDepartures } = classifyDueBookings(
      [],
      [{ id: '2', booking_ref: 'D1', check_out_date: '2026-09-30', occupant: occ('Kofi'), room }],
      today,
    )
    expect(overdueDepartures).toHaveLength(1)
    expect(todayDepartures).toHaveLength(0)
  })

  it('buckets a departure due exactly today as todayDepartures', () => {
    const today = '2026-10-02'
    const { todayDepartures, overdueDepartures } = classifyDueBookings(
      [],
      [{ id: '2', booking_ref: 'D1', check_out_date: today, occupant: occ('Kofi'), room }],
      today,
    )
    expect(todayDepartures).toHaveLength(1)
    expect(overdueDepartures).toHaveLength(0)
  })

  it('returns empty buckets when nothing is due', () => {
    const result = classifyDueBookings([], [], '2026-10-02')
    expect(result.todayArrivals).toHaveLength(0)
    expect(result.overdueArrivals).toHaveLength(0)
    expect(result.todayDepartures).toHaveLength(0)
    expect(result.overdueDepartures).toHaveLength(0)
  })
})
