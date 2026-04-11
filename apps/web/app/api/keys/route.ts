import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

// GET /api/keys?status=issued — all keys, optionally filtered by status
export async function GET(req: NextRequest) {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = req.nextUrl.searchParams.get('status')

  const supabase = await createClient()
  let query = supabase
    .from('room_keys')
    .select(`
      *,
      rooms(room_number, block),
      bookings(booking_ref),
      occupants(first_name, last_name)
    `)
    .eq('tenant_id', tenantId)
    .order('rooms(room_number)')

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
