#!/usr/bin/env node
/**
 * Tenant-scoping audit — fails CI when a tenant-scoped table is queried
 * through the raw `createAdminClient()` without an explicit `.eq('tenant_id', …)`
 * filter or migration to `createTenantAdminClient()`.
 *
 * The rule:
 *   For every `.from('TABLE')` call in a file that imports
 *   `createAdminClient`, the next 800 characters must contain either
 *     • `.eq('tenant_id', …)`
 *     • the call sits in the `CROSS_TENANT_TABLES` allow-list
 *     • the file path matches a `SAFE_BY_DESIGN` prefix (cron, public,
 *       webhook, admin-overview etc.)
 *     • the surrounding scope uses the `createTenantAdminClient` wrapper.
 *
 * Findings outside that allow-list cause the script to exit non-zero so the
 * change must either filter explicitly or switch to the scoped wrapper
 * before it can land.
 *
 * Usage:
 *   node apps/web/scripts/audit-tenant-scoping.mjs       # from repo root
 *   npm --workspace @gh-hostels/web run audit:tenant-scoping
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, posix, relative, sep } from 'node:path'

// Resolve from this script's location so it works regardless of CWD.
const WEB_ROOT = new URL('..', import.meta.url).pathname

const SCAN_DIRS = ['app', 'lib']

const CROSS_TENANT_TABLES = new Set([
  'tenants',
  'tenant_members',
  'platform_admins',
  'plans',
  'subscription_plans',
  'paystack_subscription_plans',
  'tenant_subscriptions',
])

const SAFE_BY_DESIGN_PREFIXES = [
  // Platform super-admin — cross-tenant by design
  'app/(admin)/admin/page.tsx',
  // Cron jobs iterate over every tenant
  'app/api/cron/',
  // Auth bootstrap — keyed on globally-unique user_id
  'app/auth/callback/route.ts',
  // Occupant portal layout — looks up tenant from user_id (single record)
  'app/(occupant-portal)/layout.tsx',
  // Paystack callbacks/webhooks — tenant resolved from event payload or
  // user_id bootstrap before switching to scoped client
  'app/api/occupant/pay/callback/route.ts',
  'app/api/payments/paystack/webhook/route.ts',
  // Slug-resolved public surfaces
  'app/api/public/',
  'app/(public)/checkin/',
  // Globally-keyed session lookups
  'lib/auth/occupant-session.ts',
  // Multi-tenant insert (each row carries its own tenant_id)
  'lib/anomaly-detector.ts',
]

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) yield* walk(full)
    else yield full
  }
}

function isScannable(file) {
  if (file.endsWith('.d.ts')) return false
  return /\.(ts|tsx)$/.test(file)
}

function findFromCalls(src) {
  const out = []
  const re = /\.from\(['"]([^'"]+)['"]\)/g
  let m
  while ((m = re.exec(src)) !== null) {
    out.push({ index: m.index, table: m[1] })
  }
  return out
}

function lineOf(src, index) {
  return src.slice(0, index).split('\n').length
}

function audit() {
  const findings = []

  for (const root of SCAN_DIRS) {
    const abs = join(WEB_ROOT, root)
    let files
    try {
      files = [...walk(abs)]
    } catch {
      continue
    }
    for (const fullPath of files) {
      if (!isScannable(fullPath)) continue
      const rel = relative(WEB_ROOT, fullPath).split(sep).join(posix.sep)
      const src = readFileSync(fullPath, 'utf8')
      if (!src.includes('createAdminClient')) continue

      for (const { index, table } of findFromCalls(src)) {
        if (CROSS_TENANT_TABLES.has(table)) continue

        const window = src.slice(index, index + 800)
        if (window.includes(".eq('tenant_id'")) continue
        if (window.includes('tenant_id=')) continue

        // Look back ~1500 chars: if the latest client construction in scope
        // is the tenant-scoped wrapper, we're safe.
        const before = src.slice(Math.max(0, index - 1500), index)
        const lastAdmin = before.lastIndexOf('createAdminClient')
        const lastTenantAdmin = before.lastIndexOf('createTenantAdminClient')
        if (lastTenantAdmin > lastAdmin) continue

        // If the file has no createAdminClient call before this point, the
        // .from() is on something else entirely (e.g. a different supabase
        // client) — skip.
        if (lastAdmin === -1) continue

        // Safe-by-design prefix?
        if (SAFE_BY_DESIGN_PREFIXES.some((p) => rel.startsWith(p))) continue

        findings.push({ file: rel, line: lineOf(src, index), table })
      }
    }
  }
  return findings
}

const findings = audit()

if (findings.length === 0) {
  console.log('✓ tenant-scoping audit: no leaks detected')
  process.exit(0)
}

console.error('✗ tenant-scoping audit failed — these queries do not scope by tenant_id:')
console.error('')
for (const f of findings) {
  console.error(`  ${f.file}:${f.line}  .from('${f.table}')`)
}
console.error('')
console.error('Fix options:')
console.error('  1. Switch the client to createTenantAdminClient(tenantId).')
console.error('  2. Add .eq(\'tenant_id\', tenantId) to the query.')
console.error('  3. If the call is legitimately cross-tenant (cron, super-admin,')
console.error('     webhook, public-slug resolved), add its path to')
console.error('     SAFE_BY_DESIGN_PREFIXES in this script with a comment.')
process.exit(1)
