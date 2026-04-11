import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({ booking_id: z.string().uuid() })

// POST /api/kiosk/checkin — one-tap confirm check-in
export async function POST(req: NextRequest) {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'booking_id required' }, { status: 422 })

  const supabase = await createClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status')
    .eq('id', parsed.data.booking_id)
    .eq('tenant_id', tenantId)
    .single()

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (!['confirmed', 'pending_payment'].includes(booking.status)) {
    return NextResponse.json({ error: `Cannot check in a booking with status "${booking.status}"` }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('bookings')
    .update({
      status:          'checked_in',
      actual_check_in: new Date().toISOString(),
    })
    .eq('id', parsed.data.booking_id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update room status
  await supabase
    .from('rooms')
    .update({ status: 'occupied' })
    .eq('id', (data as any).room_id)
    .eq('tenant_id', tenantId)

  return NextResponse.json(data)
}
