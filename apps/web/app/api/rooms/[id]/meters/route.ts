import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  utility_type:   z.enum(['electricity', 'water', 'gas']),
  reading_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reading_value:  z.number().nonnegative(),
  previous_value: z.number().nonnegative().optional(),
  unit:           z.enum(['kWh', 'm3', 'L']).default('kWh'),
  unit_rate:      z.number().int().nonnegative().default(0),  // pesewas per unit
  notes:          z.string().max(500).optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const utility = searchParams.get('utility')

  const supabase = await createClient()
  let q = supabase
    .from('meter_readings')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('room_id', id)
    .order('reading_date', { ascending: false })
    .limit(30)

  if (utility) q = q.eq('utility_type', utility)

  const { data } = await q
  return NextResponse.json(data ?? [])
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 422 })

  // Auto-fetch previous value if not provided
  let { previous_value } = parsed.data
  if (previous_value === undefined) {
    const { data: last } = await supabase
      .from('meter_readings')
      .select('reading_value')
      .eq('tenant_id', tenantId)
      .eq('room_id', id)
      .eq('utility_type', parsed.data.utility_type)
      .order('reading_date', { ascending: false })
      .limit(1)
      .maybeSingle()
    previous_value = last?.reading_value ?? undefined
  }

  const { data, error } = await supabase
    .from('meter_readings')
    .insert({
      tenant_id: tenantId,
      room_id:   id,
      ...parsed.data,
      previous_value: previous_value ?? null,
      recorded_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
