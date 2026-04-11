import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const itemSchema = z.object({
  item:      z.string().min(1),
  condition: z.enum(['good', 'fair', 'damaged', 'missing']),
  notes:     z.string().optional(),
})

const schema = z.object({
  type:              z.enum(['check_in', 'check_out', 'routine', 'maintenance']).default('check_in'),
  booking_id:        z.string().uuid().optional(),
  overall_condition: z.enum(['excellent', 'good', 'fair', 'poor']).optional(),
  items:             z.array(itemSchema).default([]),
  notes:             z.string().max(1000).optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data } = await supabase
    .from('room_inspections')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('room_id', id)
    .order('created_at', { ascending: false })
    .limit(20)

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

  const { data, error } = await (supabase.from('room_inspections') as any)
    .insert({
      tenant_id:         tenantId,
      room_id:           id,
      ...parsed.data,
      status:            'completed',
      inspected_by:      user.id,
      inspected_at:      new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
