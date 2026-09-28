/**
 * Unit tests for lib/reports/period-archive.ts — the fixed-lookback
 * Weekly/Monthly/Yearly archive behind PeriodArchivePicker (ported from
 * AMP Lodge's "Booking Breakdown Archive"). A fixed reference date makes
 * these deterministic regardless of when the suite runs.
 */
import { describe, expect, it } from 'vitest'
import { getArchivePeriods, getArchivePeriod } from '@/lib/reports/period-archive'

// A Monday, chosen so week-boundary math has an unambiguous expected answer.
const REF = new Date('2026-09-28T12:00:00')

describe('getArchivePeriods', () => {
  it('returns 12 weeks, idx 0 = current week starting on Monday', () => {
    const periods = getArchivePeriods('week', REF)
    expect(periods).toHaveLength(12)
    expect(periods[0]).toMatchObject({ idx: 0, label: 'This Week', from: '2026-09-28', to: '2026-10-04' })
    expect(periods[1]).toMatchObject({ idx: 1, from: '2026-09-21', to: '2026-09-27' })
  })

  it('returns 12 months, idx 0 = current calendar month', () => {
    const periods = getArchivePeriods('month', REF)
    expect(periods).toHaveLength(12)
    expect(periods[0]).toMatchObject({ idx: 0, label: 'This Month', from: '2026-09-01', to: '2026-09-30' })
    expect(periods[1]).toMatchObject({ idx: 1, from: '2026-08-01', to: '2026-08-31' })
  })

  it('returns 3 years, idx 0 = current calendar year', () => {
    const periods = getArchivePeriods('year', REF)
    expect(periods).toHaveLength(3)
    expect(periods[0]).toMatchObject({ idx: 0, label: 'This Year', from: '2026-01-01', to: '2026-12-31' })
    expect(periods[1]).toMatchObject({ idx: 1, label: '2025', from: '2025-01-01', to: '2025-12-31' })
  })

  it('periods are contiguous with no gaps or overlaps (weekly)', () => {
    const periods = getArchivePeriods('week', REF)
    for (let i = 0; i < periods.length - 1; i++) {
      const earlier = new Date(periods[i + 1].to)
      const later = new Date(periods[i].from)
      const gapDays = Math.round((later.getTime() - earlier.getTime()) / 86400000)
      expect(gapDays).toBe(1)
    }
  })
})

describe('getArchivePeriod', () => {
  it('clamps an out-of-range idx to the last valid period', () => {
    const periods = getArchivePeriods('week', REF)
    const clamped = getArchivePeriod('week', 999, REF)
    expect(clamped).toEqual(periods[periods.length - 1])
  })

  it('clamps a negative idx up to 0', () => {
    const period = getArchivePeriod('week', -5, REF)
    expect(period.idx).toBe(0)
  })
})
