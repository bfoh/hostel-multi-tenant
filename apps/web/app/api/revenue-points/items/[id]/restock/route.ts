import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { getServerTenantId } from '@/lib/auth/tenant'

/**
 * POST /api/revenue-points/items/[id]/restock — adds to an item's
 * stock_qty and logs an inventory_movements row for the audit trail.
 * There's no separate "make this item stock-tracked" step — restocking an
 * item that's currently untracked (stock_qty null, e.g. a service/pass
 * that was never meant to be counted) simply turns tracking on for it,
 * starting from 0. Staff never restock items they don't want tracked, so
 * this needs no extra confirmation step.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const body = await req.json().catch(() => null)
  const quantity = Number(body?.quantity)
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: 'quantity must be a positive number' }, { status: 422 })
  }

  const admin = await createTenantAdminClientFromHeaders()

  const { data: item } = await (admin as any)
    .from('revenue_point_items')
    .select('id, stock_qty')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  const newStock = (item.stock_qty ?? 0) + Math.round(quantity)

  const { error: updateErr } = await (admin as any)
    .from('revenue_point_items')
    .update({ stock_qty: newStock })
    .eq('id', id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  await (admin as any).from('inventory_movements').insert({
    tenant_id:     tenantId,
    item_id:       id,
    movement_type: 'purchase',
    quantity:      Math.round(quantity),
    created_by:    user.id,
    notes:         body?.notes || null,
  })

  return NextResponse.json({ stock_qty: newStock })
}
