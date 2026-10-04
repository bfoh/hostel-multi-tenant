/**
 * Fixed-lookback period archive for reports — 12 past weeks / 12 past
 * months / 3 past years, each independently selectable, mirroring AMP
 * Lodge's "Booking Breakdown Archive" picker (its own lookback is also a
 * fixed count, not derived from account age — see that repo's
 * AnalyticsPage.tsx). idx 0 is always the current/most-recent period.
 */
export type ArchiveMode = 'week' | 'month' | 'year'

export interface ArchivePeriod {
  idx:   number
  label: string
  /** Inclusive ISO date (yyyy-mm-dd) bounds. */
  from:  string
  to:    string
}

export interface PeriodTimestampBounds {
  /** Inclusive UTC start of the first calendar day. */
  from: string
  /** Exclusive UTC start of the day after the final calendar day. */
  to: string
}

const COUNTS: Record<ArchiveMode, number> = { week: 12, month: 12, year: 3 }

// Formats the Date's LOCAL calendar date — toISOString() converts to UTC
// first, which silently shifts the date back a day in negative-UTC-offset
// timezones (e.g. the Americas) for any local time before UTC midnight.
function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function mondayOf(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? 6 : day - 1
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff)
  return m
}

export function getArchivePeriods(mode: ArchiveMode, now: Date = new Date()): ArchivePeriod[] {
  const count = COUNTS[mode]
  const periods: ArchivePeriod[] = []

  if (mode === 'week') {
    const thisMonday = mondayOf(now)
    for (let i = 0; i < count; i++) {
      const start = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - i * 7)
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)
      const label = i === 0
        ? 'This Week'
        : `${start.toLocaleDateString('en-GH', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-GH', { month: 'short', day: 'numeric' })}`
      periods.push({ idx: i, label, from: isoDate(start), to: isoDate(end) })
    }
  } else if (mode === 'month') {
    for (let i = 0; i < count; i++) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
      const label = i === 0 ? 'This Month' : start.toLocaleDateString('en-GH', { month: 'long', year: 'numeric' })
      periods.push({ idx: i, label, from: isoDate(start), to: isoDate(end) })
    }
  } else {
    for (let i = 0; i < count; i++) {
      const year  = now.getFullYear() - i
      const start = new Date(year, 0, 1)
      const end   = new Date(year, 11, 31)
      const label = i === 0 ? 'This Year' : String(year)
      periods.push({ idx: i, label, from: isoDate(start), to: isoDate(end) })
    }
  }

  return periods
}

/** Clamps an out-of-range idx (e.g. a stale bookmarked URL) to the nearest valid period. */
export function getArchivePeriod(mode: ArchiveMode, idx: number, now: Date = new Date()): ArchivePeriod {
  const periods = getArchivePeriods(mode, now)
  return periods[Math.min(Math.max(idx, 0), periods.length - 1)]
}

/**
 * Converts inclusive date-only archive bounds into a half-open timestamp
 * range. Using the next day's midnight avoids losing transactions posted on
 * the final day when PostgreSQL compares date-based journal entries.
 */
export function getPeriodTimestampBounds(period: ArchivePeriod): PeriodTimestampBounds {
  const [year, month, day] = period.to.split('-').map(Number)
  const exclusiveEnd = new Date(Date.UTC(year, month - 1, day + 1))

  return {
    from: `${period.from}T00:00:00.000Z`,
    to: exclusiveEnd.toISOString(),
  }
}
