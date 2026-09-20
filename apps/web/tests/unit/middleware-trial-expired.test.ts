/**
 * Regression guard for the minimal post-trial dashboard's allow-list in
 * middleware.ts. The live access-boundary behavior (what a trial_expired
 * tenant can actually mutate) is covered end-to-end at the RLS layer in
 * tests/db/trial-expiry-access.test.ts — this test guards the middleware's
 * path list itself, so an edit that silently removes a path a post-trial
 * owner needs (or leaves in one they shouldn't have) is caught here rather
 * than only discovered manually.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = readFileSync(path.resolve(__dirname, '../../middleware.ts'), 'utf8')

function extractAllowList(src: string): string[] {
  const match = src.match(/MINIMAL_DASHBOARD_ALLOWED_PATHS = \[([\s\S]*?)\]/)
  if (!match) {
    throw new Error(
      'Could not find MINIMAL_DASHBOARD_ALLOWED_PATHS in middleware.ts — did its shape change? ' +
        'Update the regex in this test to match.',
    )
  }
  return Array.from(match[1].matchAll(/'([^']+)'/g)).map((m) => m[1])
}

describe('minimal post-trial dashboard allow-list', () => {
  const allowList = extractAllowList(SRC)

  it('keeps room-price editing, bookings, billing, listing settings, and account basics reachable', () => {
    expect(allowList).toEqual(
      expect.arrayContaining([
        '/dashboard', '/rooms/categories', '/bookings',
        '/settings/billing', '/settings/listing', '/my-account', '/onboarding',
      ]),
    )
  })

  it('does not accidentally allow-list full management sections', () => {
    const shouldStayBlocked = [
      '/staff', '/accounting', '/invoices', '/payments', '/portfolio',
      '/reports', '/intelligence', '/ai', '/occupants', '/maintenance',
    ]
    for (const blocked of shouldStayBlocked) {
      expect(allowList.some((p) => blocked.startsWith(p) || p.startsWith(blocked))).toBe(false)
    }
  })

  it('applies the guard as a redirect for pages and a 402 for mutating API calls', () => {
    expect(SRC).toMatch(/tenantStatus === 'trial_expired'/)
    expect(SRC).toMatch(/status: 402/)
  })
})
