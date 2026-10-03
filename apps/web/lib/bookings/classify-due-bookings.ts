export interface DueBooking {
  id: string
  booking_ref: string
  check_in_date?: string
  check_out_date?: string
  occupant: { first_name: string; last_name: string; phone: string | null } | null
  room: { room_number: string; block: string | null } | null
}

/** Splits already-due bookings into today's work and overdue exceptions. */
export function classifyDueBookings(
  arrivals: DueBooking[],
  departures: DueBooking[],
  today: string
) {
  const overdueArrivals = arrivals.filter(
    (booking) => booking.check_in_date && booking.check_in_date < today
  )
  const todayArrivals = arrivals.filter((booking) => !overdueArrivals.includes(booking))
  const overdueDepartures = departures.filter(
    (booking) => booking.check_out_date && booking.check_out_date < today
  )
  const todayDepartures = departures.filter((booking) => !overdueDepartures.includes(booking))

  return { todayArrivals, overdueArrivals, todayDepartures, overdueDepartures }
}
