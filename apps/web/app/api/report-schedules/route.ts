import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  name:         z.string().min(1).max(100),
  report_type:  z.enum(['bookings', 'occupants', 'payments', 'maintenance', 'expenses']),
  frequency:    z.enum(['daily', 'weekly', 'monthly']),
  day_of_week:  z.number().int().min(0).max(6).optional(),
  day_of_month: z.number().int().min(1).max(28).optional(),
  recipients:   z.array(z.string().email()).min(1).max(10),
  is_active:    z.boolean().default(true),
})

function computeNextRun(frequency: string, dayOfWeek?: number, dayOfMonth?: number): Date {
  const now = new Date()
  const next = new Date(now)

  if (frequency === 'daily') {
    next.setDate(next.getDate() + 1)
    next.setHours(6, 0, 0, 0)
  } else if (frequency === 'weekly') {
    const dow = dayOfWeek ?? 1 // Monday default
    const diff = (dow - now.getDay() + 7) % 7 || 7
    next.setDate(next.getDate() + diff)
    next.setHours(6, 0, 0, 0)
  } else {
    // monthly
    const dom = dayOfMonth ?? 1
    next.setMonth(next.getMonth() + 1, dom)
    next.setHours(6, 0, 0, 0)
  }
  return next
}

// GET /api/report-schedules
export async function GET() {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('report_schedules')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/report-schedules
export async function POST(req: NextRequest) {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 422 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const nextRun = computeNextRun(parsed.data.frequency, parsed.data.day_of_week, parsed.data.day_of_month)

  const { data, error } = await (supabase.from('report_schedules') as any)
    .insert({
      tenant_id:    tenantId,
      created_by:   user?.id,
      next_run_at:  nextRun.toISOString(),
      ...parsed.data,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
