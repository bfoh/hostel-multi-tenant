import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { createClient } from '@/lib/supabase/server'
import { getServerBusinessType } from '@/lib/auth/tenant'

const CHARGE_CATEGORIES = [
  'food_beverage', 'room_service', 'minibar', 'laundry', 'phone_internet', 'parking', 'other',
] as const

const PAYMENT_METHODS = [
  'momo_mtn', 'momo_vodafone', 'momo_airteltigo', 'card', 'bank_transfer', 'cash', 'cheque',
] as const

const schema = z.object({
  description:    z.string().min(1).max(200),
  category:       z.enum(CHARGE_CATEGORIES),
  quantity:       z.number().int().positive().default(1),
  unit_price:     z.number().int().min(0),
  payment_method: z.enum(PAYMENT_METHODS).nullable().optional(),
  paid:           z.boolean().default(true),
  notes:          z.string().max(500).optional(),
})

/**
 * Folio line-items (minibar, laundry, room service, etc.) — hotel-only,
 * ported from AMP Lodge's booking_charges concept. Deliberately not folded
 * into bookings.final_amount (a generated column relied on elsewhere) — a
 * booking's true bill is final_amount + sum(booking_charges.amount),
 * computed at read time by every consumer (invoice, staff-revenue).
 */

// GET /api/bookings/[id]/charges — list charges for a booking
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if ((await getServerBusinessType()) !== 'hotel') {
    return NextResponse.json({ error: 'Not available for this account type' }, { status: 403 })
  }

  const { id } = await params
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createTenantAdminClientFromHeaders()
  const { data, error } = await supabase
    .from('booking_charges')
    .select('*')
    .eq('booking_id', id)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/bookings/[id]/charges — add a charge to a booking's folio
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if ((await getServerBusinessType()) !== 'hotel') {
    return NextResponse.json({ error: 'Not available for this account type' }, { status: 403 })
  }

  const { id } = await params
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createTenantAdminClientFromHeaders()

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  // No folio edits once the guest has checked out or the booking is
  // cancelled — mirrors AMP Lodge's own rule.
  if (['checked_out', 'cancelled'].includes(booking.status)) {
    return NextResponse.json({ error: 'Cannot add charges to a checked-out or cancelled booking' }, { status: 409 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })

  const { data, error } = await supabase
    .from('booking_charges')
    .insert({
      tenant_id:      tenantId,
      booking_id:     id,
      description:    parsed.data.description,
      category:       parsed.data.category,
      quantity:       parsed.data.quantity,
      unit_price:     parsed.data.unit_price,
      payment_method: parsed.data.payment_method ?? null,
      paid:           parsed.data.paid,
      notes:          parsed.data.notes ?? null,
      created_by:     user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
