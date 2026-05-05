/**
 * Role gate for tenant-side API routes.
 *
 * Verifies the authenticated user holds one of the allowed roles for the
 * given tenant. Returns the resolved context on success, or a NextResponse
 * 401/403 on failure that the caller should return directly.
 *
 * Reads the role from the `x-tenant-role` request header injected by
 * middleware — same pattern used by every page under `app/(tenant)/`.
 */

import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export type TenantRole =
  | 'owner'
  | 'manager'
  | 'receptionist'
  | 'housekeeper'
  | 'accountant'
  | 'security'
  | 'occupant'

export interface TenantRoleContext {
  userId:   string
  tenantId: string
  role:     TenantRole
}

export async function requireTenantRole(
  tenantId: string,
  allowed: TenantRole[],
): Promise<TenantRoleContext | NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (await headers()).get('x-tenant-role') as TenantRole | null
  if (!role)                       return NextResponse.json({ error: 'No tenant role context' }, { status: 403 })
  if (!allowed.includes(role))     return NextResponse.json({ error: 'Insufficient role' }, { status: 403 })

  return { userId: user.id, tenantId, role }
}
