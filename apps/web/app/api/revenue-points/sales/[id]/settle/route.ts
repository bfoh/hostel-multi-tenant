import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/revenue-points/sales/[id]/settle
 *
 * Marks a cash-on-pickup sale (status='pending_pickup') as settled — the
 * customer has handed over the cash. Flipping the status into a settled
 * state fires the existing journal_revenue_point_sale trigger, which posts
 * DR cash / CR revenue. Laundry settles to 'collected', everything else to
 * 'completed'.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const tenantId = (await headers()).get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const { id } = await params
  const admin = createAdminClient()

  const { data: sale } = await (admin as any)
    .from('revenue_point_sales')
    .select('id, status, revenue_point_id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!sale) return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
  if (sale.status !== 'pending_pickup') {
    return NextResponse.json({ error: `Sale is already "${sale.status}"` }, { status: 400 })
  }

  // Laundry tracks fulfilment → 'collected'; gym/sports/other → 'completed'
  const { data: point } = await (admin as any)
    .from('revenue_points')
    .select('type')
    .eq('id', sale.revenue_point_id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  const settledStatus = point?.type === 'laundry' ? 'collected' : 'completed'

  const { error } = await (admin as any)
    .from('revenue_point_sales')
    .update({ status: settledStatus })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, status: settledStatus })
}
