import { NextResponse, type NextRequest } from 'next/server'
import { getServerTenantId } from '@/lib/auth/tenant'
import { requireTenantRole } from '@/lib/auth/tenant-role'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { insertSystemMessage } from '@/lib/maintenance/messages'
import { sendPushToUsers } from '@/lib/push'
import { sendMaintenanceReopened } from '@/lib/sms'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 400 })

  const ctx = await requireTenantRole(tenantId, ['owner', 'manager'])
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  const admin  = await createTenantAdminClientFromHeaders() as any

  const { data: mr } = await admin
    .from('maintenance_requests')
    .select('id, status, occupant_id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!mr) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (mr.status !== 'completed') return NextResponse.json({ error: 'Not closed' }, { status: 409 })

  const upd = await admin
    .from('maintenance_requests')
    .update({ status: 'open', closed_by_kind: null, resolved_at: null })
    .eq('id', id)
  if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 })

  await insertSystemMessage({
    tenantId,
    requestId: id,
    body:      'Reopened by staff',
  })

  if (mr.occupant_id) {
    const { data: occ } = await admin
      .from('occupants')
      .select('user_id, phone, first_name')
      .eq('id', mr.occupant_id)
      .maybeSingle()
    const { data: tenantRow } = await admin
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .maybeSingle()
    const hostelName = tenantRow?.name ?? 'Hostel'

    if (occ?.user_id) {
      sendPushToUsers(tenantId, [occ.user_id], {
        title: 'Request reopened',
        body:  'Hostel staff reopened your request',
        url:   `/occupant-portal/maintenance/${id}`,
      }).catch(err => console.error('[reopen push]', err))
    }
    if (occ?.phone && occ?.first_name) {
      sendMaintenanceReopened({
        phone:     occ.phone,
        firstName: occ.first_name,
        requestId: id.slice(0, 8),
        hostelName,
        tenantId,
      }).catch(err => console.error('[reopen sms]', err))
    }
  }

  return NextResponse.json({ ok: true })
}
