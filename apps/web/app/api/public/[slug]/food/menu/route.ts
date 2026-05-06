import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTodaysMenu } from '@/lib/food/menu'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const admin = createAdminClient() as any

  const { data: tenant } = await admin
    .from('tenants')
    .select('id, name, primary_color, logo_url, food_orders_enabled, food_cutoff_time, paystack_subaccount_code')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()
  if (!tenant) return NextResponse.json({ error: 'Hostel not found' }, { status: 404 })
  if (!tenant.food_orders_enabled) {
    return NextResponse.json({ enabled: false }, { status: 200 })
  }

  const menu = await getTodaysMenu(tenant.id)
  return NextResponse.json({
    enabled:        true,
    tenant: {
      id:            tenant.id,
      name:          tenant.name,
      primary_color: tenant.primary_color,
      logo_url:      tenant.logo_url,
    },
    cutoff:         tenant.food_cutoff_time ?? null,
    online_enabled: !!tenant.paystack_subaccount_code,
    ...menu,
  })
}
