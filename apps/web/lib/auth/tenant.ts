import { headers } from 'next/headers'

/**
 * Returns the current tenant ID for a server-side request.
 *
 * Resolution order:
 *   1. x-tenant-id header set by middleware (production custom domain / subdomain)
 *   2. x-tenant-id header set by middleware from JWT claims (localhost dev)
 *
 * All API routes that write to tenant-scoped tables must call this and
 * include the returned id in their insert/update payload.
 */
export async function getServerTenantId(): Promise<string | null> {
  const headersList = await headers()
  return headersList.get('x-tenant-id') ?? null
}
