import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { getServerBusinessType } from '@/lib/auth/tenant'

const CHARGE_CATEGORIES = [
  'food_beverage', 'room_service', 'minibar', 'laundry', 'phone_internet', 'parking', 'other',
] as const

const PAYMENT_METHODS = [
  'momo_mtn', 'momo_vodafone', 'momo_airteltigo', 'card', 'bank_transfer', 'cash', 'cheque',
] as const

const schema = z.object({
  description:    z.string().min(1).max(200).optional(),
  category:       z.enum(CHARGE_CATEGORIES).optional(),
  quantity:       z.number().int().positive().optional(),
  unit_price:     z.number().int().min(0).optional(),
  payment_method: z.enum(PAYMENT_METHODS).nullable().optional(),
  paid:           z.boolean().optional(),
  notes:          z.string().max(500).nullable().optional(),
})

async function loadBookingAndCharge(
  supabase: Awaited<ReturnType<typeof createTenantAdminClientFromHeaders>>,
  tenantId: string,
  bookingId: string,
  chargeId: string,
) {
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status')
    .eq('id', bookingId)
    .eq('tenant_id', tenantId)
    .single()

  const { data: charge } = await supabase
    .from('booking_charges')
    .select('id')
    .eq('id', chargeId)
    .eq('booking_id', bookingId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  return { booking, charge }
}

// PATCH /api/bookings/[id]/charges/[chargeId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; chargeId: string }> }
) {
  if ((await getServerBusinessType()) !== 'hotel') {
    return NextResponse.json({ error: 'Not available for this account type' }, { status: 403 })
  }

  const { id, chargeId } = await params
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createTenantAdminClientFromHeaders()
  const { booking, charge } = await loadBookingAndCharge(supabase, tenantId, id, chargeId)
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (!charge) return NextResponse.json({ error: 'Charge not found' }, { status: 404 })

  if (['checked_out', 'cancelled'].includes(booking.status)) {
    return NextResponse.json({ error: 'Cannot edit charges on a checked-out or cancelled booking' }, { status: 409 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })

  const { data, error } = await supabase
    .from('booking_charges')
    .update(parsed.data)
    .eq('id', chargeId)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/bookings/[id]/charges/[chargeId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; chargeId: string }> }
) {
  if ((await getServerBusinessType()) !== 'hotel') {
    return NextResponse.json({ error: 'Not available for this account type' }, { status: 403 })
  }

  const { id, chargeId } = await params
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createTenantAdminClientFromHeaders()
  const { booking, charge } = await loadBookingAndCharge(supabase, tenantId, id, chargeId)
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (!charge) return NextResponse.json({ error: 'Charge not found' }, { status: 404 })

  if (['checked_out', 'cancelled'].includes(booking.status)) {
    return NextResponse.json({ error: 'Cannot delete charges on a checked-out or cancelled booking' }, { status: 409 })
  }

  const { error } = await supabase
    .from('booking_charges')
    .delete()
    .eq('id', chargeId)
    .eq('tenant_id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
