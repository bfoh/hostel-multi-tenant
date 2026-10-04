import { NextResponse, type NextRequest } from 'next/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { requireTenantRole } from '@/lib/auth/tenant-role'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 400 })

  const ctx = await requireTenantRole(tenantId, ['owner', 'accountant'])
  if (ctx instanceof NextResponse) return ctx

  const { id }   = await params
  const admin    = await createTenantAdminClientFromHeaders()
  const { data: updated, error } = await (admin as any).rpc('undo_bank_draft_approval', {
    p_tenant_id: tenantId,
    p_payment_id: id,
    p_actor_id: ctx.userId,
  })

  if (error?.code === 'P0002') return NextResponse.json({ error: error.message }, { status: 410 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(updated)
}
