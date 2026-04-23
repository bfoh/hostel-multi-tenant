import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'

/**
 * POST /api/revenue-points/items — Add a product/service to a revenue point
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const body = await req.json().catch(() => null)
  if (!body?.revenue_point_id || !body?.name || typeof body?.unit_price !== 'number') {
    return NextResponse.json({
      error: 'revenue_point_id, name, and unit_price are required',
    }, { status: 422 })
  }

  const admin = createAdminClient()

  const { data, error } = await (admin as any)
    .from('revenue_point_items')
    .insert({
      tenant_id:        tenantId,
      revenue_point_id: body.revenue_point_id,
      name:             body.name,
      category:         body.category ?? null,
      unit_price:       body.unit_price,
      unit:             body.unit ?? 'item',
      sort_order:       body.sort_order ?? 0,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
