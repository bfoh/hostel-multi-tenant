import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { listMaintenanceStaffUserIds } from '@/lib/maintenance/messages'
import { sendPushToUsers } from '@/lib/push'

const createSchema = z.object({
  title:       z.string().min(3).max(200),
  category:    z.enum(['plumbing', 'electrical', 'hvac', 'structural', 'furniture', 'appliance', 'cleaning', 'pest_control', 'security', 'other']),
  priority:    z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  description: z.string().max(1000).optional().nullable(),
})

async function getOccupantContext(userId: string, tenantId: string) {
  const admin = createAdminClient()
  const { data: occupant } = await admin
    .from('occupants')
    .select('id')
    .eq('user_id', userId as any)
    .eq('tenant_id', tenantId)
    .single()
  if (!occupant) return null

  const { data: booking } = await admin
    .from('bookings')
    .select('id, room_id')
    .eq('occupant_id', occupant.id)
    .eq('tenant_id', tenantId)
    .in('status', ['checked_in', 'confirmed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return { occupant, booking: booking ?? null }
}

// GET /api/occupant/maintenance — list this occupant's requests
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 400 })

  const ctx = await getOccupantContext(user.id, tenantId)
  if (!ctx) return NextResponse.json([])

  if (!ctx.booking?.room_id) return NextResponse.json([])

  const admin = createAdminClient()
  const { data } = await admin
    .from('maintenance_requests')
    .select('id, title, category, priority, status, description, created_at, resolved_at')
    .eq('tenant_id', tenantId)
    .eq('room_id', ctx.booking.room_id)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json(data ?? [])
}

// POST /api/occupant/maintenance — create a new maintenance request
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 400 })

  const body   = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 422 })

  const ctx = await getOccupantContext(user.id, tenantId)
  if (!ctx) return NextResponse.json({ error: 'Occupant not found' }, { status: 404 })
  if (!ctx.booking) return NextResponse.json({ error: 'No active booking found' }, { status: 400 })

  const admin = createAdminClient()
  const { data: request, error } = await (admin as any)
    .from('maintenance_requests')
    .insert({
      tenant_id:   tenantId,
      occupant_id: ctx.occupant.id,
      title:       parsed.data.title,
      category:    parsed.data.category,
      priority:    parsed.data.priority,
      description: parsed.data.description ?? null,
      room_id:     ctx.booking.room_id ?? null,
      status:      'open',
      source:      'occupant_portal',
    })
    .select('id, title, status, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify maintenance staff (owner/manager/housekeeper) of the new request.
  // Fire-and-forget so push failures never block the response.
  const recipients = await listMaintenanceStaffUserIds(tenantId)
  if (recipients.length > 0) {
    sendPushToUsers(recipients, {
      title: 'New maintenance request',
      body:  `${parsed.data.priority.toUpperCase()} · ${parsed.data.title.slice(0, 80)}`,
      url:   `/maintenance/${request.id}`,
    }).catch(err => console.error('[new request push]', err))
  }

  return NextResponse.json({ ok: true, request }, { status: 201 })
}
