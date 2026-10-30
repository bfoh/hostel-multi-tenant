import { describe, expect, it } from 'vitest'

import { isValidStayRange } from '@/lib/validation/stay-dates'

describe('isValidStayRange', () => {
  it('accepts a check-out after check-in', () => {
    expect(isValidStayRange('2026-01-01', '2026-01-02')).toBe(true)
    expect(isValidStayRange('2026-12-31', '2027-01-01')).toBe(true)
  })

  it('rejects a same-day stay, which would slip past the capacity trigger', () => {
    expect(isValidStayRange('2026-01-05', '2026-01-05')).toBe(false)
  })

  it('rejects a check-out before check-in', () => {
    expect(isValidStayRange('2026-02-05', '2026-02-01')).toBe(false)
    expect(isValidStayRange('2027-01-01', '2026-12-31')).toBe(false)
  })
})
