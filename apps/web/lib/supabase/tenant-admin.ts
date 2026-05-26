/**
 * Tenant-scoped admin Supabase client.
 *
 * Wraps `createAdminClient()` (service-role key, bypasses RLS) with a Proxy
 * that auto-injects `tenant_id` filtering on every query so a developer
 * cannot accidentally leak rows across tenants by forgetting `.eq('tenant_id', …)`.
 *
 * Behaviour per query method on tenant-scoped tables:
 *   .select(...)        → auto-appends .eq('tenant_id', tenantId)
 *   .update(row)        → strips tenant_id from row, then .eq('tenant_id', tenantId)
 *   .delete()           → auto-appends .eq('tenant_id', tenantId)
 *   .insert(row | rows) → merges { tenant_id } into each row
 *   .upsert(row | rows) → merges { tenant_id } into each row, then .eq filter
 *
 * Tables in CROSS_TENANT_TABLES (platform-global tables like `tenants`,
 * `platform_admins`) pass through untouched. Use `.from(table)` for those too —
 * the wrapper detects them by name. For an explicit escape hatch use
 * `.fromGlobal(table)` which always skips filtering.
 *
 * Storage and RPC are passed through unmodified (`client.storage`,
 * `client.rpc(...)`) — wrap their semantics yourself if you need tenant
 * scoping inside them.
 *
 * NEVER expose this client or the SERVICE_ROLE_KEY to the browser.
 */
import { headers } from 'next/headers'

import { createAdminClient } from './admin'

/** Tables that legitimately span tenants. No tenant_id filter applied. */
const CROSS_TENANT_TABLES = new Set<string>([
  'tenants',
  'tenant_members',
  'platform_admins',
  'plans',
  'subscription_plans',
  'paystack_subscription_plans',
  'tenant_subscriptions',
])

function wrapQueryBuilder(qb: any, tenantId: string): any {
  return new Proxy(qb, {
    get(target, prop, receiver) {
      const original = (target as any)[prop]

      if (prop === 'select') {
        return (...args: any[]) => {
          const next = original.apply(target, args)
          // .select returns a FilterBuilder; auto-add tenant filter
          return next.eq('tenant_id', tenantId)
        }
      }

      if (prop === 'insert') {
        return (rows: any, opts?: any) => {
          const stamped = stampTenantId(rows, tenantId)
          return original.call(target, stamped, opts)
        }
      }

      if (prop === 'upsert') {
        return (rows: any, opts?: any) => {
          const stamped = stampTenantId(rows, tenantId)
          const next = original.call(target, stamped, opts)
          // Upsert returns a FilterBuilder; keep the tenant scope on its read-side too
          return typeof next?.eq === 'function' ? next.eq('tenant_id', tenantId) : next
        }
      }

      if (prop === 'update') {
        return (row: any, opts?: any) => {
          const { tenant_id: _drop, ...safe } = row ?? {}
          const next = original.call(target, safe, opts)
          return next.eq('tenant_id', tenantId)
        }
      }

      if (prop === 'delete') {
        return (opts?: any) => {
          const next = original.call(target, opts)
          return next.eq('tenant_id', tenantId)
        }
      }

      return Reflect.get(target, prop, receiver)
    },
  })
}

function stampTenantId(rows: any, tenantId: string) {
  if (Array.isArray(rows)) {
    return rows.map((r) => ({ ...r, tenant_id: tenantId }))
  }
  if (rows && typeof rows === 'object') {
    return { ...rows, tenant_id: tenantId }
  }
  return rows
}

/**
 * Returns an admin Supabase client where every tenant-scoped `.from(table)`
 * call is automatically constrained to the given `tenantId`.
 *
 * @example
 *   const supabase = createTenantAdminClient(tenantId)
 *   const { data } = await supabase.from('rooms').select('id, name')
 *   // → SELECT ... WHERE tenant_id = $tenantId
 */
export function createTenantAdminClient(tenantId: string | null | undefined) {
  if (!tenantId) {
    throw new Error('createTenantAdminClient: tenantId is required (received empty/null)')
  }
  const client = createAdminClient()

  const proxy = new Proxy(client as any, {
    get(target, prop, receiver) {
      if (prop === 'from') {
        return (table: string) => {
          const qb = target.from(table)
          if (CROSS_TENANT_TABLES.has(table)) return qb
          return wrapQueryBuilder(qb, tenantId)
        }
      }

      // Explicit escape hatch — caller is taking responsibility
      if (prop === 'fromGlobal') {
        return (table: string) => target.from(table)
      }

      return Reflect.get(target, prop, target)
    },
  })

  // Preserve the typed Supabase client surface so TS can infer row types on
  // `.select(...)`, `.update(...)`, etc. The Proxy passes everything through.
  return proxy as ReturnType<typeof createAdminClient> & {
    fromGlobal: ReturnType<typeof createAdminClient>['from']
  }
}

/**
 * Convenience: read `x-tenant-id` from request headers (middleware injects it)
 * and return a tenant-scoped admin client. Throws if the header is missing —
 * a missing header signals a programmer error (page mounted outside the
 * tenant route group, or middleware misconfiguration), not a recoverable
 * runtime condition.
 *
 * Use this in any `app/(tenant)/*` server component, server action, or API
 * route handler that runs after the tenant middleware.
 */
export async function createTenantAdminClientFromHeaders() {
  const tenantId = (await headers()).get('x-tenant-id')
  if (!tenantId) {
    throw new Error(
      'createTenantAdminClientFromHeaders: missing x-tenant-id header. ' +
        'Either the middleware did not run on this route, or the caller is ' +
        'outside the tenant context (e.g. platform-admin routes).',
    )
  }
  return createTenantAdminClient(tenantId)
}
