import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

// GET /api/kiosk/lookup?ref=BK-XXXX
// Returns booking detail for kiosk display
export async function GET(req: NextRequest) {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ref = req.nextUrl.searchParams.get('ref')?.toUpperCase().trim()
  if (!ref) return NextResponse.json({ error: 'ref required' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id, booking_ref, status, check_in_date, check_out_date,
      final_amount, paid_amount,
      occupants(first_name, last_name, phone, photo_url),
      rooms(room_number, block, floor, room_categories(name))
    `)
    .eq('tenant_id', tenantId)
    .eq('booking_ref', ref)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  return NextResponse.json(data)
}
