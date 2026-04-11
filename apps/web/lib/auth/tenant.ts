import { headers, cookies } from 'next/headers'

/**
 * Returns the current tenant ID for a server-side request.
 *
 * Resolution order:
 *   1. x-tenant-id request header injected by middleware (custom domain / subdomain)
 *   2. x-tenant-id from JWT claims (middleware injects on localhost)
 *   3. __tenant_id cookie (set by middleware as reliable fallback for fetch() API calls)
 */
export async function getServerTenantId(): Promise<string | null> {
  const headersList = await headers()
  const fromHeader  = headersList.get('x-tenant-id')
  if (fromHeader) return fromHeader

  // Cookie fallback: middleware persists the resolved tenant_id in a cookie so
  // that browser fetch() calls to API routes always carry it.
  const cookieStore = await cookies()
  return cookieStore.get('__tenant_id')?.value ?? null
}
