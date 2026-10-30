/**
 * Regression guard for the logged-out routes in middleware.ts.
 *
 * NO_AUTH_PATHS used to be matched with a bare startsWith(), so the
 * dashboard's /bookings and /visitors rode on the public '/book' and
 * '/visit' entries and skipped the signed-in checks (login redirect,
 * resident-portal redirect, password-change and trial guards).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'
import { isUnderPath } from '@/lib/path-prefix'

const ROOT = path.resolve(__dirname, '../..')
const SRC = readFileSync(path.join(ROOT, 'middleware.ts'), 'utf8')

function extractNoAuthPaths(src: string): string[] {
  const match = src.match(/const NO_AUTH_PATHS = \[([\s\S]*?)\]/)
  if (!match) {
    throw new Error(
      'Could not find NO_AUTH_PATHS in middleware.ts — did its shape change? ' +
        'Update the regex in this test to match.',
    )
  }
  return Array.from(match[1].matchAll(/'([^']+)'/g)).map((m) => m[1])
}

const NO_AUTH = extractNoAuthPaths(SRC)
const isNoAuth = (pathname: string) => NO_AUTH.some((p) => isUnderPath(pathname, p))

/** URL paths of every dashboard page (the (tenant) route group). */
function dashboardRoutes(): string[] {
  const out: string[] = []
  const walk = (dir: string, url: string) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name)
      if (!statSync(full).isDirectory()) continue
      const next = /^\(.*\)$/.test(name) ? url : `${url}/${name}`
      if (readdirSync(full).includes('page.tsx')) out.push(next)
      walk(full, next)
    }
  }
  walk(path.join(ROOT, 'app/(tenant)'), '')
  return out
}

describe('middleware logged-out paths', () => {
  it('keeps the public marketplace and booking pages logged out', () => {
    for (const p of ['/browse', '/listing/acacia-court', '/book', '/book/confirm', '/visit/abc', '/portal/xyz', '/order/123', '/api/public/listings', '/privacy', '/terms']) {
      expect(isNoAuth(p)).toBe(true)
    }
  })

  it('does not let dashboard routes ride on a public prefix', () => {
    for (const p of ['/bookings', '/bookings/new', '/bookings/calendar', '/visitors', '/portfolio', '/dashboard', '/settings/listing']) {
      expect(isNoAuth(p)).toBe(false)
    }
  })

  it('treats no dashboard page as public', () => {
    const routes = dashboardRoutes()
    expect(routes.length).toBeGreaterThan(20)
    expect(routes.filter(isNoAuth)).toEqual([])
  })

  it('is what middleware.ts actually uses to match NO_AUTH_PATHS', () => {
    expect(SRC).toMatch(/NO_AUTH_PATHS\.some\(\(p\) => isUnderPath\(pathname, p\)\)/)
  })
})

describe('isUnderPath', () => {
  it('matches whole path segments only', () => {
    expect(isUnderPath('/book', '/book')).toBe(true)
    expect(isUnderPath('/book/x', '/book')).toBe(true)
    expect(isUnderPath('/bookings', '/book')).toBe(false)
    expect(isUnderPath('/visitors', '/visit')).toBe(false)
    expect(isUnderPath('/api/public/x', '/api/public/')).toBe(true)
  })
})
