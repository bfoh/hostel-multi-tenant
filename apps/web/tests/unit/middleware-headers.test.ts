/**
 * Regression guard for the tenant-header spoofing fix in middleware.ts.
 *
 * The fix strips a hardcoded list of headers before any other logic runs,
 * so a client-forged x-tenant-id (or similar) can never survive on a path
 * where injection is conditional. That protection only holds if the strip
 * list stays in sync with every header the middleware ever sets — this test
 * parses the real source and fails if someone adds a new `x-...` header
 * assignment without adding it to the strip list too.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = readFileSync(path.resolve(__dirname, '../../middleware.ts'), 'utf8')

function extractStripList(src: string): string[] {
  const match = src.match(/for \(const h of \[([\s\S]*?)\]\) \{\s*reqHeaders\.delete\(h\)/)
  if (!match) {
    throw new Error(
      'Could not find the header strip loop in middleware.ts — did its shape change? ' +
        'Update the regex in this test to match.',
    )
  }
  return Array.from(match[1].matchAll(/'([^']+)'/g)).map((m) => m[1])
}

function extractSetHeaderNames(src: string): string[] {
  const names = new Set<string>()
  for (const m of src.matchAll(/\b(?:reqHeaders|h)\.set\(\s*'([^']+)'/g)) {
    names.add(m[1])
  }
  return [...names]
}

describe('middleware tenant header hygiene', () => {
  it('finds a non-empty strip list (sanity check that the regex above still matches)', () => {
    expect(extractStripList(SRC).length).toBeGreaterThan(0)
  })

  it('strips every header it ever sets', () => {
    const stripList = extractStripList(SRC)
    const setNames = extractSetHeaderNames(SRC)
    const missing = setNames.filter((n) => !stripList.includes(n))
    expect(missing).toEqual([])
  })
})
