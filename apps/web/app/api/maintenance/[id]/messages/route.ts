import { NextResponse, type NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { getServerTenantId } from '@/lib/auth/tenant'
import { requireTenantRole } from '@/lib/auth/tenant-role'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { hasPriorStaffMessage, MAINTENANCE_ROLES } from '@/lib/maintenance/messages'
import { uploadAttachments } from '@/lib/maintenance/attachments'
import { sendPushToUsers } from '@/lib/push'
import { sendMaintenanceFirstStaffReply } from '@/lib/sms'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 400 })

  const ctx = await requireTenantRole(tenantId, MAINTENANCE_ROLES)
  if (ctx instanceof NextResponse) return ctx
  const { userId } = ctx

  const { id } = await params
  const admin  = await createTenantAdminClientFromHeaders() as any

  const { data: mr } = await admin
    .from('maintenance_requests')
    .select('id, status, occupant_id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!mr) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (mr.status === 'cancelled') return NextResponse.json({ error: 'Cancelled' }, { status: 409 })

  const form = await req.formData()
  const body = (form.get('body') as string | null)?.trim() || null
  const files: File[] = []
  for (const v of form.getAll('files')) if (v instanceof File && v.size > 0) files.push(v)
  if (!body && files.length === 0) return NextResponse.json({ error: 'Empty' }, { status: 400 })
  if (body && body.length > 2000) return NextResponse.json({ error: 'Too long' }, { status: 400 })

  const isFirstStaffMessage = !(await hasPriorStaffMessage(id, tenantId))
  const messageId           = randomUUID()

  let attachmentPaths: string[] = []
  if (files.length > 0) {
    const up = await uploadAttachments({ files, tenantId, requestId: id, messageId })
    if ('error' in up) return NextResponse.json({ error: up.error }, { status: 400 })
    attachmentPaths = up.paths
  }

  const inserted = await admin.from('maintenance_messages').insert({
    id:             messageId,
    tenant_id:      tenantId,
    request_id:     id,
    author_user_id: userId,
    author_kind:    'staff',
    body,
    attachments:    attachmentPaths,
  }).select('id, created_at').single()
  if (inserted.error) return NextResponse.json({ error: inserted.error.message }, { status: 500 })

  // Resolve resident contact
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
      sendPushToUsers([occ.user_id], {
        title: isFirstStaffMessage ? 'Reply from hostel staff' : 'New reply',
        body:  body ? body.slice(0, 120) : '(attachment)',
        url:   `/occupant-portal/maintenance/${id}`,
      }).catch(err => console.error('[staff message push]', err))
    }
    if (isFirstStaffMessage && occ?.phone && occ?.first_name) {
      sendMaintenanceFirstStaffReply({
        phone:      occ.phone,
        firstName:  occ.first_name,
        requestId:  id.slice(0, 8),
        hostelName,
        tenantId,
      }).catch(err => console.error('[staff first-reply sms]', err))
    }
  }

  return NextResponse.json({ id: inserted.data.id, created_at: inserted.data.created_at }, { status: 201 })
}
