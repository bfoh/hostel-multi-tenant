import { NextResponse, type NextRequest } from 'next/server'
import { getOccupantSession } from '@/lib/auth/occupant-session'
import { createAdminClient } from '@/lib/supabase/admin'
import { insertSystemMessage, listMaintenanceStaffUserIds } from '@/lib/maintenance/messages'
import { sendPushToUsers } from '@/lib/push'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOccupantSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin  = createAdminClient() as any

  const { data: mr } = await admin
    .from('maintenance_requests')
    .select('id, status, occupant_id')
    .eq('id', id)
    .eq('tenant_id', session.tenantId)
    .eq('occupant_id', session.occupantId)
    .maybeSingle()
  if (!mr) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (mr.status === 'completed' || mr.status === 'cancelled') {
    return NextResponse.json({ error: 'Already closed' }, { status: 409 })
  }

  const upd = await admin
    .from('maintenance_requests')
    .update({ status: 'completed', closed_by_kind: 'occupant', resolved_at: new Date().toISOString() })
    .eq('id', id)
  if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 })

  await insertSystemMessage({
    tenantId:  session.tenantId,
    requestId: id,
    body:      'Closed by resident',
  })

  const recipients = await listMaintenanceStaffUserIds(session.tenantId)
  if (recipients.length > 0) {
    sendPushToUsers(recipients, {
      title: 'Request closed by resident',
      body:  'Maintenance request resolved',
      url:   `/maintenance/${id}`,
    }).catch(err => console.error('[occupant close push]', err))
  }

  return NextResponse.json({ ok: true })
}
