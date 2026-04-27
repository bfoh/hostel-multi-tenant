import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'

const schema = z.object({
  title:                 z.string().min(1).max(150).optional(),
  description:           z.string().max(500).optional().nullable(),
  category:              z.enum(['plumbing','electrical','hvac','structural','furniture','appliance','cleaning','pest_control','security','other']).optional(),
  room_id:               z.string().uuid().optional().nullable(),
  location_note:         z.string().max(200).optional().nullable(),
  frequency:             z.enum(['daily','weekly','fortnightly','monthly','quarterly','biannual','annual']).optional(),
  interval_value:        z.number().int().min(1).optional(),
  start_date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  next_due_date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  default_priority:      z.enum(['low','medium','high','urgent']).optional(),
  default_contractor_id: z.string().uuid().optional().nullable(),
  estimated_cost_ghs:    z.number().min(0).optional().nullable(),
  status:                z.enum(['active','paused','archived']).optional(),
  notes:                 z.string().max(500).optional().nullable(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const { id }   = await params
  const body     = await request.json().catch(() => null)
  const parsed   = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('pm_schedules')
    .update(parsed.data)
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const { id } = await params
  const supabase = createAdminClient()
  await supabase.from('pm_schedules').delete().eq('id', id).eq('tenant_id', tenantId)
  return NextResponse.json({ ok: true })
}
