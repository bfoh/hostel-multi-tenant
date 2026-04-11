import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

// GET /api/bookings/expiring?days=30
// Returns bookings whose check_out_date is within `days` days
export async function GET() {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const today    = new Date().toISOString().slice(0, 10)
  const in30     = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

  const { data } = await supabase
    .from('bookings')
    .select(`
      id, booking_ref, status, check_in_date, check_out_date, rate_per_unit, rate_unit, final_amount, paid_amount,
      occupants(first_name, last_name, phone, email),
      rooms(room_number, block, room_categories(name))
    `)
    .eq('tenant_id', tenantId)
    .in('status', ['confirmed', 'checked_in'])
    .gte('check_out_date', today)
    .lte('check_out_date', in30)
    .order('check_out_date')

  return NextResponse.json(data ?? [])
}
