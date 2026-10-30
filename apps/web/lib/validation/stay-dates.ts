/**
 * Guest-facing stay-date rule. Bookings are stored as a half-open
 * [check_in, check_out) range, so a check-out on or before check-in is
 * never a real stay: a reversed range makes Postgres throw a raw range
 * error (surfacing as a 500), and an empty same-day range overlaps nothing,
 * so it slips past enforce_room_capacity() even on a fully booked room.
 *
 * Both inputs must already be YYYY-MM-DD (the schemas' regex), which makes
 * plain string comparison a correct date comparison.
 */
export function isValidStayRange(checkIn: string, checkOut: string): boolean {
  return checkOut > checkIn
}

export const STAY_RANGE_ERROR = {
  message: 'Check-out must be after check-in',
  path: ['check_out_date'],
}
