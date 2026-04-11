import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  amount:       z.number().int().positive(),
  method:       z.enum(['cash','momo_mtn','momo_vodafone','momo_airteltigo','bank_transfer','card','cheque']),
  reference:    z.string().max(100).optional(),
  collected_at: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  notes:        z.string().max(500).optional(),
})

// GET /api/bookings/[id]/deposit
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('damage_deposits')
    .select('*')
    .eq('booking_id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/bookings/[id]/deposit — record deposit for a booking
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, occupant_id, status')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 422 })

  const { data: existing } = await supabase
    .from('damage_deposits')
    .select('id')
    .eq('booking_id', id)
    .maybeSingle()

  if (existing) return NextResponse.json({ error: 'A deposit is already recorded for this booking' }, { status: 409 })

  const { data, error } = await supabase
    .from('damage_deposits')
    .insert({
      tenant_id:    tenantId,
      booking_id:   id,
      occupant_id:  booking.occupant_id,
      amount:       parsed.data.amount,
      method:       parsed.data.method,
      reference:    parsed.data.reference,
      collected_at: parsed.data.collected_at ?? new Date().toISOString(),
      notes:        parsed.data.notes,
      status:       'held',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
