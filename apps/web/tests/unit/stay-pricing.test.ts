import { describe, expect, it } from 'vitest'
import { billableUnits, stayTotal } from '@/lib/bookings/stay-pricing'

describe('billableUnits', () => {
  it('bills nights stayed', () => {
    expect(billableUnits('night', '2026-11-02', '2026-11-05')).toBe(3)
    expect(billableUnits('night', '2026-11-02', '2026-11-03')).toBe(1)
  })

  it('bills weeks started', () => {
    expect(billableUnits('week', '2026-11-01', '2026-11-08')).toBe(1)
    expect(billableUnits('week', '2026-11-01', '2026-11-09')).toBe(2)
  })

  it('bills calendar months started, clamping month ends', () => {
    expect(billableUnits('month', '2026-01-15', '2026-02-15')).toBe(1)
    expect(billableUnits('month', '2026-01-15', '2026-03-15')).toBe(2)
    expect(billableUnits('month', '2026-01-15', '2026-03-16')).toBe(3)
    expect(billableUnits('month', '2026-01-31', '2026-02-28')).toBe(1)
    expect(billableUnits('month', '2026-09-01', '2027-05-31')).toBe(9)
  })

  it('keeps semester and unknown units at one unit', () => {
    expect(billableUnits('semester', '2026-09-01', '2026-12-20')).toBe(1)
    expect(billableUnits(null, '2026-09-01', '2026-12-20')).toBe(1)
    expect(billableUnits('fortnight', '2026-09-01', '2026-12-20')).toBe(1)
  })

  it('never bills less than one unit (same-day, reversed or open-ended stays)', () => {
    expect(billableUnits('night', '2026-11-02', '2026-11-02')).toBe(1)
    expect(billableUnits('night', '2026-11-05', '2026-11-02')).toBe(1)
    expect(billableUnits('night', '2026-11-02', null)).toBe(1)
    expect(billableUnits('night', '', '2026-11-05')).toBe(1) // form before dates are picked
  })

  it('accepts full timestamps by their date part', () => {
    expect(billableUnits('night', '2026-11-02T14:00:00Z', '2026-11-04T10:00:00Z')).toBe(2)
  })
})

describe('stayTotal', () => {
  it('multiplies the rate by billable units in pesewas', () => {
    expect(stayTotal(120_000, 'night', '2026-11-02', '2026-11-05')).toBe(360_000)
    expect(stayTotal(450_000, 'semester', '2026-09-01', '2026-12-20')).toBe(450_000)
  })
})
