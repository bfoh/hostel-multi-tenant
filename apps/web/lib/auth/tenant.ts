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

export type BusinessType = 'hostel' | 'hotel'

/**
 * Returns the current tenant's vertical from the x-tenant-business-type
 * header middleware injects (see middleware.ts's strip-then-reset pattern —
 * this can't be spoofed by the caller). Defaults to 'hostel', matching the
 * DB column's own default for tenants that predate the hotel vertical.
 */
export async function getServerBusinessType(): Promise<BusinessType> {
  const headersList = await headers()
  return headersList.get('x-tenant-business-type') === 'hotel' ? 'hotel' : 'hostel'
}
