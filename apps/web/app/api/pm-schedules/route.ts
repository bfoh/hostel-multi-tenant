import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getServerTenantId } from '@/lib/auth/tenant'
import { computeNextDue, type PmFrequency } from '@/lib/data/pm-schedules'

const schema = z.object({
  title:                 z.string().min(1).max(150),
  description:           z.string().max(500).optional().nullable(),
  category:              z.enum(['plumbing','electrical','hvac','structural','furniture','appliance','cleaning','pest_control','security','other']).default('other'),
  room_id:               z.string().uuid().optional().nullable(),
  location_note:         z.string().max(200).optional().nullable(),
  frequency:             z.enum(['daily','weekly','fortnightly','monthly','quarterly','biannual','annual']),
  interval_value:        z.number().int().min(1).default(1),
  start_date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  default_priority:      z.enum(['low','medium','high','urgent']).default('medium'),
  default_contractor_id: z.string().uuid().optional().nullable(),
  estimated_cost_ghs:    z.number().min(0).optional().nullable(),
  notes:                 z.string().max(500).optional().nullable(),
})

export async function POST(request: NextRequest) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const body   = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })

  const d = parsed.data
  const next_due_date = computeNextDue(d.start_date, d.frequency as PmFrequency, d.interval_value)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pm_schedules')
    .insert({ ...d, tenant_id: tenantId, next_due_date })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
