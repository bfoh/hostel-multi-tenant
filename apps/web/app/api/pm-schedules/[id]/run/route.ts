import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServerTenantId } from '@/lib/auth/tenant'
import { advancePmSchedule } from '@/lib/data/pm-schedules'

/**
 * POST /api/pm-schedules/:id/run
 * Spawns a maintenance_request work order from this schedule and advances next_due_date.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const { id } = await params
  const supabase = await createClient()

  // Fetch the schedule (RLS ensures tenant ownership)
  const { data: schedule, error: fetchErr } = await supabase
    .from('pm_schedules')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (fetchErr || !schedule) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })

  // Generate ref number
  const refNum = `MR-PM-${Date.now().toString(36).toUpperCase()}`

  // Spawn a work order
  const { data: wo, error: woErr } = await (supabase.from('maintenance_requests') as any)
    .insert({
      tenant_id:        tenantId,
      title:            `[PM] ${schedule.title}`,
      description:      schedule.description,
      category:         schedule.category,
      room_id:          schedule.room_id,
      location_note:    schedule.location_note,
      priority:         schedule.default_priority,
      contractor_id:    schedule.default_contractor_id,
      estimated_cost:   schedule.estimated_cost_ghs ? Math.round(schedule.estimated_cost_ghs * 100) : null,
      notes:            schedule.notes,
      status:           'open',
      ref_number:       refNum,
      pm_schedule_id:   id,
      scheduled_date:   schedule.next_due_date,
    })
    .select('id')
    .single()

  if (woErr) return NextResponse.json({ error: woErr.message }, { status: 500 })

  // Advance the schedule's next_due_date
  await advancePmSchedule(id)

  return NextResponse.json({ work_order_id: wo.id }, { status: 201 })
}
