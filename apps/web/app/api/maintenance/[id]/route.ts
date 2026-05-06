import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { insertSystemMessage } from '@/lib/maintenance/messages'
import { sendPushToUsers } from '@/lib/push'
import { sendMaintenanceStatusChange } from '@/lib/sms'

const schema = z.object({
  status:         z.enum(['open', 'in_progress', 'on_hold', 'completed', 'cancelled']).optional(),
  priority:       z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  contractor_id:  z.string().uuid().optional().nullable(),
  actual_cost:    z.number().int().min(0).optional().nullable(),
  scheduled_date: z.string().optional().nullable(),
  resolved_at:    z.string().optional().nullable(),
  notes:          z.string().max(500).optional().nullable(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })

  const supabase = createAdminClient() as any

  // Capture previous status for system-message + notification logic
  const { data: existing } = await supabase
    .from('maintenance_requests')
    .select('status, occupant_id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const update = { ...parsed.data }
  if (parsed.data.status === 'completed' && !parsed.data.resolved_at) {
    Object.assign(update, { resolved_at: new Date().toISOString() })
  }

  const { error } = await supabase
    .from('maintenance_requests')
    .update(update)
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Status changed → log system message + notify resident
  if (parsed.data.status && parsed.data.status !== existing.status) {
    await insertSystemMessage({
      tenantId,
      requestId: id,
      body:      `Status changed: ${existing.status} → ${parsed.data.status}`,
    })

    if (existing.occupant_id) {
      const { data: occ } = await supabase
        .from('occupants')
        .select('user_id, phone, first_name')
        .eq('id', existing.occupant_id)
        .maybeSingle()
      const { data: tenantRow } = await supabase
        .from('tenants')
        .select('name')
        .eq('id', tenantId)
        .maybeSingle()
      const hostelName = tenantRow?.name ?? 'Hostel'

      if (occ?.user_id) {
        sendPushToUsers([occ.user_id], {
          title: `Request ${String(parsed.data.status).replace('_', ' ')}`,
          body:  'Status updated by hostel staff',
          url:   `/occupant-portal/maintenance/${id}`,
        }).catch(err => console.error('[status push]', err))
      }
      if (occ?.phone && occ?.first_name) {
        sendMaintenanceStatusChange({
          phone:     occ.phone,
          firstName: occ.first_name,
          requestId: id.slice(0, 8),
          from:      String(existing.status),
          to:        String(parsed.data.status),
          hostelName,
          tenantId,
        }).catch(err => console.error('[status sms]', err))
      }
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('maintenance_requests')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
