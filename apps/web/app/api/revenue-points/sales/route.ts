import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { getServerTenantId } from '@/lib/auth/tenant'

/**
 * POST /api/revenue-points/sales — Record a sale at a revenue point
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const body = await req.json().catch(() => null)
  if (!body?.revenue_point_id || !body?.description || !body?.total_amount || !body?.payment_method) {
    return NextResponse.json({
      error: 'revenue_point_id, description, total_amount, and payment_method are required',
    }, { status: 422 })
  }

  const admin = await createTenantAdminClientFromHeaders()

  const { data, error } = await (admin as any)
    .from('revenue_point_sales')
    .insert({
      tenant_id:        tenantId,
      revenue_point_id: body.revenue_point_id,
      item_id:          body.item_id ?? null,
      description:      body.description,
      quantity:         body.quantity ?? 1,
      unit_price:       body.unit_price ?? body.total_amount,
      total_amount:     body.total_amount,
      payment_method:   body.payment_method,
      reference:        body.reference ?? null,
      customer_name:    body.customer_name ?? null,
      occupant_id:      body.occupant_id ?? null,
      sold_by:          user.id,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
