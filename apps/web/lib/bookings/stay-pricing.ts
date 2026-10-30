/**
 * How many rate units a stay is billed for, and what that costs.
 *
 * Bookings used to be charged one unit of the category's base_rate whatever
 * the dates, so a 3-night hotel stay billed as 1 night. Stays are now billed
 * per unit across the half-open [check_in, check_out) range:
 *
 *   night    → nights stayed
 *   week     → weeks started (8 nights = 2 weeks)
 *   month    → calendar months started (15 Jan → 16 Mar = 3 months)
 *   semester → 1 (a semester booking already spans the whole term)
 *
 * Unknown units and same-day/reversed ranges keep the old single-unit price
 * so nothing is ever billed at zero.
 */

const DAY_MS = 86_400_000

function parseDate(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`)
}

function daysBetween(from: string, to: string): number {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / DAY_MS)
}

/** `from` plus `months` calendar months, clamped to the last day of the month (31 Jan + 1 → 28/29 Feb). */
function addMonths(from: Date, months: number): Date {
  const target = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(from.getUTCDate(), lastDay))
  return target
}

function monthsStarted(from: string, to: string): number {
  const start = parseDate(from)
  const end = parseDate(to)
  let months = 1
  while (addMonths(start, months) < end) months++
  return months
}

/** Units in the period [from, to); 0 for an empty period or an unknown unit. */
function unitsInPeriod(rateUnit: string, from: string, to: string): number {
  const days = daysBetween(from, to)
  if (!Number.isFinite(days) || days <= 0) return 0
  switch (rateUnit) {
    case 'night': return days
    case 'week':  return Math.ceil(days / 7)
    case 'month': return monthsStarted(from, to)
    default:      return 0
  }
}

/** Billable units for a new stay. Always at least 1. */
export function billableUnits(rateUnit: string | null | undefined, checkIn: string, checkOut: string | null | undefined): number {
  if (!rateUnit || rateUnit === 'semester' || !checkOut) return 1
  return Math.max(1, unitsInPeriod(rateUnit, checkIn, checkOut))
}

/** Total for a new stay, in the same minor units (pesewas) as baseRate. */
export function stayTotal(baseRate: number, rateUnit: string | null | undefined, checkIn: string, checkOut: string | null | undefined): number {
  return baseRate * billableUnits(rateUnit, checkIn, checkOut)
}
