/**
 * Role gate for tenant-side API routes.
 *
 * Verifies the authenticated user holds one of the allowed roles for the
 * given tenant. Returns the resolved context on success, or a NextResponse
 * 401/403 on failure that the caller should return directly.
 *
 * Resolves the role authoritatively from `tenant_members` rather than
 * trusting the `x-tenant-role` header. The header is correct in the common
 * case but can survive untouched from a malicious client when the user
 * isn't an active tenant member (middleware only overwrites the header on
 * a successful role lookup). For security-critical actions we don't take
 * the chance — one PK lookup is cheap.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
  allowed: readonly TenantRole[],
): Promise<TenantRoleContext | NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: member } = await admin
    .from('tenant_members')
    .select('role, is_active')
    .eq('user_id', user.id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!member || !member.is_active) {
    return NextResponse.json({ error: 'Not an active member of this tenant' }, { status: 403 })
  }

  const role = member.role as TenantRole
  if (!allowed.includes(role)) {
    return NextResponse.json({ error: 'Insufficient role' }, { status: 403 })
  }

  return { userId: user.id, tenantId, role }
}
