import { NextResponse } from 'next/server'
import { getOccupantSession } from '@/lib/auth/occupant-session'
import { getTodaysMenu } from '@/lib/food/menu'
import { createTenantAdminClient } from '@/lib/supabase/tenant-admin'

export async function GET() {
  const session = await getOccupantSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createTenantAdminClient(session.tenantId) as any
  const { data: tenant } = await admin
    .from('tenants')
    .select('food_orders_enabled, food_cutoff_time')
    .eq('id', session.tenantId)
    .maybeSingle()
  if (!tenant?.food_orders_enabled) {
    return NextResponse.json({ enabled: false, categories: [], items: [] })
  }

  const menu = await getTodaysMenu(session.tenantId)
  return NextResponse.json({ enabled: true, ...menu, cutoff: tenant.food_cutoff_time ?? null })
}
