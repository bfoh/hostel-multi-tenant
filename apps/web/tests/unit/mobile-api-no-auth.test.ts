/**
 * Regression guard: /api/mobile/role and /api/mobile/tenant-theme both
 * document (in their own route file comments) that an unauthenticated
 * caller gets a graceful 200 response — the Capacitor mobile shell relies
 * on this during boot, before it knows whether the user has a session.
 * Neither route enforces its own auth requirement via middleware; each
 * does its own inline `supabase.auth.getUser()` check and branches
 * accordingly. That contract only holds if middleware.ts's own
 * auth-required gate is skipped for these paths (NO_AUTH_PATHS) — found
 * broken in production (a live 307-to-/login for an unauthenticated
 * request) because these two paths were missing from that list.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = readFileSync(path.resolve(__dirname, '../../middleware.ts'), 'utf8')

function extractNoAuthPaths(src: string): string[] {
  const match = src.match(/const NO_AUTH_PATHS = \[([\s\S]*?)\]/)
  if (!match) {
    throw new Error('Could not find NO_AUTH_PATHS in middleware.ts — did its shape change? Update this test.')
  }
  return Array.from(match[1].matchAll(/'([^']+)'/g)).map((m) => m[1])
}

describe('middleware NO_AUTH_PATHS', () => {
  it('includes both mobile-shell-boot API routes that must gracefully handle no session', () => {
    const paths = extractNoAuthPaths(SRC)
    expect(paths).toContain('/api/mobile/role')
    expect(paths).toContain('/api/mobile/tenant-theme')
  })
})
