import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data } = await supabase
    .from('rooms')
    .select('id, room_number, block, status, room_categories(name, base_rate, rate_unit)')
    .eq('tenant_id', tenantId)
    .in('status', ['available', 'reserved'])
    .order('room_number')

  return NextResponse.json(data ?? [])
}
