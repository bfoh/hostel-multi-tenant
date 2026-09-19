#!/usr/bin/env node
/**
 * Function-grant audit — fails CI when a SECURITY DEFINER Postgres function
 * that takes a tenant/room-scoping ID parameter is reachable by any role
 * other than service_role.
 *
 * Why this exists: Supabase exposes every function in the `public` schema
 * as a PostgREST RPC endpoint (`/rest/v1/rpc/<name>`), gated purely by
 * whatever GRANT EXECUTE that role holds. A SECURITY DEFINER function that
 * internally scopes its work by a caller-supplied ID (`p_tenant_id`,
 * `p_room_id`, ...) but doesn't verify the *caller* actually has any
 * relationship to that ID is safe only if it's unreachable by anyone other
 * than the service role — the app calling it through createAdminClient()
 * is not itself a security boundary, since the same function is equally
 * callable directly, bypassing the app entirely, by anyone holding EXECUTE.
 *
 * This exact bug shipped three times in this repo (see migration
 * 20240001000117_lock_down_tenant_scoped_rpc_grants.sql for the incident):
 * two functions were explicitly `grant`ed to `authenticated` for no reason
 * the app needed, and one (compute_daily_report) had no grant statement at
 * all — Postgres grants EXECUTE to PUBLIC by default on every new
 * function (unlike tables, which default to no access), so "no grant" is
 * itself a finding, not a safe default.
 *
 * The rule:
 *   For every `create [or replace] function <name>(<args>)` across all of
 *   supabase/migrations/*.sql that is SECURITY DEFINER and has a parameter
 *   matching RISKY_PARAM_PATTERN, track every GRANT/REVOKE EXECUTE
 *   statement mentioning that function name across ALL migration files (a
 *   function's grants can be changed by a later migration than the one
 *   that defined it). If the most recent grant/revoke state includes
 *   `authenticated`, `anon`, or `public` — or no grant/revoke statement
 *   ever mentions the function at all (the implicit-PUBLIC case) — it's a
 *   finding, unless the function is in ALLOWLIST with a comment explaining
 *   why it's safe.
 *
 * KNOWN LIMITATIONS — same spirit as audit-tenant-scoping.mjs:
 *   1. Regex-based, not a SQL parser. A function or grant statement written
 *      in an unusual style (unusual whitespace, schema-qualified in one
 *      place but not another, etc.) could be missed. When in doubt, this
 *      script is written to fail the audit (a false positive you have to
 *      allowlist) rather than silently pass (a false negative) — see the
 *      "no grant/revoke ever mentions it" branch.
 *   2. RISKY_PARAM_PATTERN is a naming-convention heuristic
 *      (`p_tenant_id`, `p_room_id`, ...), matching how every function
 *      found by hand in this codebase names its scoping parameter. A
 *      function using a different parameter name for the same purpose
 *      would be missed. A function whose ID parameter is NOT a trust
 *      boundary (e.g. is_conversation_participant's p_conversation_id,
 *      which checks auth.uid() internally rather than trusting the
 *      caller's identity) would be flagged as a false positive — allowlist
 *      those explicitly, with a comment, rather than loosening the
 *      pattern.
 *   3. This only checks the GRANT boundary (can a given role call the
 *      function at all), not whether the function's own body correctly
 *      uses the parameter it's given — that still requires a human to read
 *      the function body once its reachability is understood.
 *
 * Usage:
 *   node apps/web/scripts/audit-function-grants.mjs
 *   npm --workspace @gh-hostels/web run audit:function-grants
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS_DIR = new URL('../../../supabase/migrations', import.meta.url).pathname

const RISKY_PARAM_PATTERN = /\bp_(tenant|room)_id\b/i

// Functions confirmed safe despite matching RISKY_PARAM_PATTERN and/or a
// broad grant, with the reason inline. Add to this only with a comment
// explaining why the function doesn't trust the caller-claimed ID.
const ALLOWLIST = new Set([
  // (none yet)
])

function listMigrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
}

/** Find every `create [or replace] function name(args) ... $$` definition in a file. */
function findFunctionDefinitions(src) {
  const defs = []
  const re = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?(\w+)\s*\(([^)]*)\)/gis
  let m
  while ((m = re.exec(src)) !== null) {
    const name = m[1]
    const args = m[2]
    // security definer normally appears within the next ~200 chars
    // (language ... [stable|volatile] security definer ...).
    const tail = src.slice(m.index, m.index + 400)
    const isSecurityDefiner = /security\s+definer/i.test(tail)
    defs.push({ name, args, isSecurityDefiner })
  }
  return defs
}

/**
 * Find every `grant ... on function name(...) to ROLE_LIST` and
 * `revoke ... on function name(...) from ROLE_LIST` statement for a given
 * function name, across a file. Returns role names added/removed.
 */
function findGrantEvents(src, name) {
  const events = []
  const re = new RegExp(
    `(grant|revoke)\\s+(?:execute|all)\\s+on\\s+function\\s+(?:public\\.)?${name}\\s*\\([^)]*\\)\\s+(?:to|from)\\s+([^;]+);`,
    'gi',
  )
  let m
  while ((m = re.exec(src)) !== null) {
    const kind = m[1].toLowerCase()
    const roles = m[2]
      .split(',')
      .map((r) => r.trim().toLowerCase())
      .filter(Boolean)
    events.push({ kind, roles })
  }
  return events
}

function audit() {
  const files = listMigrationFiles()
  const sources = files.map((f) => ({ file: f, src: readFileSync(join(MIGRATIONS_DIR, f), 'utf8') }))

  // Pass 1: find every SECURITY DEFINER function with a risky parameter.
  // A function can be `create or replace`d in multiple files — the last
  // definition wins for "does it have a risky param", but we still scan
  // grant events across every file, since a later migration might grant
  // or revoke without redefining the function.
  const candidates = new Map() // name -> { isSecurityDefiner, hasRiskyParam }
  for (const { src } of sources) {
    for (const def of findFunctionDefinitions(src)) {
      if (!RISKY_PARAM_PATTERN.test(def.args)) continue
      candidates.set(def.name, {
        isSecurityDefiner: def.isSecurityDefiner || candidates.get(def.name)?.isSecurityDefiner || false,
      })
    }
  }

  const findings = []

  for (const [name, { isSecurityDefiner }] of candidates) {
    if (!isSecurityDefiner) continue
    if (ALLOWLIST.has(name)) continue

    let sawAnyGrantEvent = false
    let currentlyGrantedToUnsafeRole = false
    let unsafeRoleSeen = null

    for (const { src } of sources) {
      for (const { kind, roles } of findGrantEvents(src, name)) {
        sawAnyGrantEvent = true
        const unsafe = roles.find((r) => r === 'authenticated' || r === 'anon' || r === 'public')
        if (kind === 'grant' && unsafe) {
          currentlyGrantedToUnsafeRole = true
          unsafeRoleSeen = unsafe
        }
        if (kind === 'revoke' && unsafe) {
          // A revoke of that specific unsafe role clears the flag; a later
          // grant elsewhere would set it again via the branch above.
          currentlyGrantedToUnsafeRole = false
        }
      }
    }

    if (!sawAnyGrantEvent) {
      findings.push({
        name,
        reason: 'no GRANT/REVOKE statement ever mentions this function — relies on Postgres\'s default EXECUTE-to-PUBLIC grant',
      })
    } else if (currentlyGrantedToUnsafeRole) {
      findings.push({ name, reason: `granted to '${unsafeRoleSeen}'` })
    }
  }

  return findings
}

const findings = audit()

if (findings.length === 0) {
  console.log('✓ function-grant audit: no over-exposed SECURITY DEFINER functions detected')
  process.exit(0)
}

console.error('✗ function-grant audit failed — these SECURITY DEFINER functions take a tenant/room-scoping')
console.error('  parameter but are reachable by more than service_role:')
console.error('')
for (const f of findings) {
  console.error(`  ${f.name}() — ${f.reason}`)
}
console.error('')
console.error('Fix options:')
console.error('  1. Add a migration: revoke all on function <name>(<args>) from public, authenticated, anon;')
console.error('     then: grant execute on function <name>(<args>) to service_role;')
console.error('     (see migration 117 for the precedent).')
console.error('  2. If the function is genuinely safe to expose (e.g. it keys off auth.uid()')
console.error('     internally rather than trusting the caller-supplied ID — see')
console.error('     is_conversation_participant), add it to ALLOWLIST in this script with a')
console.error('     comment explaining why.')
process.exit(1)
