import { NextResponse, type NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { getOccupantSession } from '@/lib/auth/occupant-session'
import { createAdminClient } from '@/lib/supabase/admin'
import { isFirstOccupantReplySinceStaff, listMaintenanceStaffUserIds } from '@/lib/maintenance/messages'
import { uploadAttachments } from '@/lib/maintenance/attachments'
import { sendPushToUsers } from '@/lib/push'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOccupantSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin  = createAdminClient()

  const { data: mr } = await (admin as any)
    .from('maintenance_requests')
    .select('id, tenant_id, occupant_id, status, room_id')
    .eq('id', id)
    .eq('tenant_id', session.tenantId)
    .eq('occupant_id', session.occupantId)
    .maybeSingle()
  if (!mr) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if ((mr as any).status === 'completed' || (mr as any).status === 'cancelled') {
    return NextResponse.json({ error: 'Request is closed' }, { status: 409 })
  }
  // Hard cutoff at checkout: occupant must have an active booking on this room
  if ((mr as any).room_id) {
    const { data: activeBooking } = await admin
      .from('bookings')
      .select('id, status')
      .eq('tenant_id', session.tenantId)
      .eq('occupant_id', session.occupantId)
      .eq('room_id', (mr as any).room_id)
      .in('status', ['confirmed', 'checked_in'])
      .limit(1)
      .maybeSingle()
    if (!activeBooking) {
      return NextResponse.json({ error: 'No active booking' }, { status: 403 })
    }
  }

  const form = await req.formData()
  const body = (form.get('body') as string | null)?.trim() || null
  const files: File[] = []
  for (const v of form.getAll('files')) {
    if (v instanceof File && v.size > 0) files.push(v)
  }
  if (!body && files.length === 0) {
    return NextResponse.json({ error: 'Empty message' }, { status: 400 })
  }
  if (body && body.length > 2000) {
    return NextResponse.json({ error: 'Body exceeds 2000 chars' }, { status: 400 })
  }

  const shouldPing = await isFirstOccupantReplySinceStaff(id, session.tenantId)
  const messageId  = randomUUID()

  let attachmentPaths: string[] = []
  if (files.length > 0) {
    const up = await uploadAttachments({
      files,
      tenantId:  session.tenantId,
      requestId: id,
      messageId,
    })
    if ('error' in up) return NextResponse.json({ error: up.error }, { status: 400 })
    attachmentPaths = up.paths
  }

  const adminAny: any = admin
  const inserted = await adminAny
    .from('maintenance_messages')
    .insert({
      id:             messageId,
      tenant_id:      session.tenantId,
      request_id:     id,
      author_user_id: session.userId,
      author_kind:    'occupant',
      body,
      attachments:    attachmentPaths,
    })
    .select('id, created_at')
    .single()
  if (inserted.error) {
    return NextResponse.json({ error: inserted.error.message }, { status: 500 })
  }

  if (shouldPing) {
    const recipients = await listMaintenanceStaffUserIds(session.tenantId)
    if (recipients.length > 0) {
      sendPushToUsers(recipients, {
        title: `New reply from ${session.firstName}`,
        body:  body ? body.slice(0, 120) : '(attachment)',
        url:   `/maintenance/${id}`,
      }).catch(err => console.error('[occupant message push]', err))
    }
  }

  return NextResponse.json({ id: inserted.data.id, created_at: inserted.data.created_at }, { status: 201 })
}
