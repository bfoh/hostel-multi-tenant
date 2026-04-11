import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data } = await supabase
    .from('occupant_feedback')
    .select('*, bookings(booking_ref, check_in_date, check_out_date, occupants(first_name, last_name))')
    .eq('tenant_id', tenantId)
    .order('submitted_at', { ascending: false })
    .limit(100)

  return NextResponse.json(data ?? [])
}
