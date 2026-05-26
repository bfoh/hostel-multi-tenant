import { NextResponse, type NextRequest } from 'next/server'
import { getServerTenantId } from '@/lib/auth/tenant'
import { requireTenantRole } from '@/lib/auth/tenant-role'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { insertSystemMessage } from '@/lib/maintenance/messages'
import { sendPushToUsers } from '@/lib/push'

const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
type P = typeof PRIORITIES[number]

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 400 })

  const ctx = await requireTenantRole(tenantId, ['owner', 'manager'])
  if (ctx instanceof NextResponse) return ctx

  const { id }   = await params
  const json     = await req.json().catch(() => null) as { priority?: string } | null
  const priority = json?.priority as P | undefined
  if (!priority || !(PRIORITIES as readonly string[]).includes(priority)) {
    return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
  }

  const admin = await createTenantAdminClientFromHeaders() as any
  const { data: mr } = await admin
    .from('maintenance_requests')
    .select('id, priority, occupant_id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!mr) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (mr.priority === priority) return NextResponse.json({ ok: true, unchanged: true })

  const upd = await admin
    .from('maintenance_requests')
    .update({ priority })
    .eq('id', id)
  if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 })

  await insertSystemMessage({
    tenantId,
    requestId: id,
    body:      `Priority changed: ${mr.priority} → ${priority}`,
  })

  if (mr.occupant_id) {
    const { data: occ } = await admin
      .from('occupants')
      .select('user_id')
      .eq('id', mr.occupant_id)
      .maybeSingle()
    if (occ?.user_id) {
      sendPushToUsers(tenantId, [occ.user_id], {
        title: `Priority: ${priority}`,
        body:  'Updated by hostel staff',
        url:   `/occupant-portal/maintenance/${id}`,
      }).catch(err => console.error('[priority push]', err))
    }
  }

  return NextResponse.json({ ok: true })
}
