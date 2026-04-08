import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

const clockInSchema = z.object({
  date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  clock_in:      z.string().optional(),   // ISO timestamp; defaults to now()
  clock_in_lat:  z.number().optional().nullable(),
  clock_in_lng:  z.number().optional().nullable(),
  notes:         z.string().optional().nullable(),
})

const clockOutSchema = z.object({
  date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  clock_out:     z.string().optional(),
  clock_out_lat: z.number().optional().nullable(),
  clock_out_lng: z.number().optional().nullable(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = clockInSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })

  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('attendance_records')
    .upsert({
      tenant_id:    tenantId,
      staff_id:     id,
      date:         parsed.data.date,
      clock_in:     parsed.data.clock_in ?? new Date().toISOString(),
      clock_in_lat: parsed.data.clock_in_lat,
      clock_in_lng: parsed.data.clock_in_lng,
      notes:        parsed.data.notes,
      recorded_by:  user.user?.id,
    }, { onConflict: 'tenant_id,staff_id,date' })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = clockOutSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })

  const supabase = await createClient()
  const { error } = await supabase
    .from('attendance_records')
    .update({
      clock_out:     parsed.data.clock_out ?? new Date().toISOString(),
      clock_out_lat: parsed.data.clock_out_lat,
      clock_out_lng: parsed.data.clock_out_lng,
    })
    .eq('tenant_id', tenantId)
    .eq('staff_id', id)
    .eq('date', parsed.data.date)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
