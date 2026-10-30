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
import { readdirSync, readFileSync } from 'node:fs'
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

// BYPASS_PATHS return before the strip loop, so a forged x-tenant-id reaches
// those routes untouched. /api/webhooks used to be listed there while its
// handlers trusted that header with a service-role client — anyone could
// manage any tenant's webhook endpoints. No bypassed route may read
// tenant context.
const APP_DIR = path.resolve(__dirname, '../../app')
const TENANT_CONTEXT = /x-tenant-|x-portal-role|x-occupant-id|x-admin-impersonating|FromHeaders\(|getServerTenantId\(/

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listFiles(path.join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [path.join(dir, e.name)] : [],
  )
}

/** URL path a file under app/ serves, ignoring (route groups). */
function urlPathOf(file: string): string {
  const segments = path.relative(APP_DIR, path.dirname(file)).split(path.sep).filter((s) => s && !/^\(.*\)$/.test(s))
  return '/' + segments.join('/')
}

describe('middleware bypass paths', () => {
  const bypass = Array.from(
    (SRC.match(/const BYPASS_PATHS = \[([\s\S]*?)\]/)?.[1] ?? '').matchAll(/'([^']+)'/g),
  ).map((m) => m[1])

  it('finds the bypass list', () => {
    expect(bypass).toContain('/api/cron')
  })

  it('no longer bypasses the tenant webhook management API', () => {
    expect(bypass.some((p) => '/api/webhooks'.startsWith(p))).toBe(false)
  })

  it('never routes a bypassed request to code that trusts tenant headers', () => {
    const offenders = listFiles(APP_DIR)
      .filter((f) => bypass.some((p) => urlPathOf(f).startsWith(p)))
      .filter((f) => TENANT_CONTEXT.test(readFileSync(f, 'utf8')))
      .map((f) => path.relative(APP_DIR, f))
    expect(offenders).toEqual([])
  })
})
