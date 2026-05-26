/**
 * Food order → revenue_point_sales bridge.
 *
 * Recognition rule: revenue lands on `picked_up`. Cancellations before
 * pickup never wrote a row, so nothing to reverse. State machine prevents
 * cancelling from `picked_up` (terminal).
 *
 * Idempotency: keyed on the food order id stored in `reference`. Re-runs
 * (realtime double-fire, page refresh) skip if a row already exists.
 */

import { createTenantAdminClient } from '@/lib/supabase/tenant-admin'

const FALLBACK_NAME = 'Restaurant'

/**
 * Resolve the tenant's restaurant revenue point.
 *
 * Prefers any existing active `type='restaurant'` row (whatever its name).
 * If none exists, auto-creates one named "Restaurant" so admins can rename
 * later from /revenue-points without breaking the food integration.
 *
 * Cleanup of the legacy auto-created "Food orders" row (from the first cut
 * of this integration) — admins can delete or rename it; future picked-up
 * orders will collapse onto whichever restaurant-type point is left.
 */
async function getOrCreateFoodRevenuePoint(tenantId: string): Promise<string | null> {
  const admin = createTenantAdminClient(tenantId) as any

  // Pick any existing restaurant point first
  const { data: existing } = await admin
    .from('revenue_points')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('type', 'restaurant')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (existing?.id) return existing.id as string

  // None — create a generic Restaurant point
  const { data: created, error } = await admin
    .from('revenue_points')
    .insert({
      tenant_id:   tenantId,
      name:        FALLBACK_NAME,
      type:        'restaurant',
      description: 'Auto-managed point for food orders (resident portal, walk-in, online). Rename from /revenue-points if desired.',
      is_active:   true,
    })
    .select('id')
    .single()
  if (error || !created) {
    console.error('[food revenue] could not create revenue point', error)
    return null
  }
  return created.id as string
}

interface FoodOrderForRevenue {
  id:             string
  tenant_id:      string
  occupant_id:    string | null
  order_ref:      string | null
  total_pesewas:  number
  payment_method: 'online' | 'cash_on_pickup'
  customer_kind:  'resident' | 'walk_in' | 'online'
  picked_up_at:   string | null
}

/** Insert a sale row for this picked-up food order. No-op if already recorded. */
export async function recordFoodSale(order: FoodOrderForRevenue): Promise<void> {
  if (!order.id || !order.tenant_id) return
  const admin = createTenantAdminClient(order.tenant_id) as any

  // Idempotency: bail if a sale already references this order
  const { data: dup } = await admin
    .from('revenue_point_sales')
    .select('id')
    .eq('tenant_id', order.tenant_id)
    .eq('reference', order.id)
    .maybeSingle()
  if (dup?.id) return

  const pointId = await getOrCreateFoodRevenuePoint(order.tenant_id)
  if (!pointId) return

  const paymentMethod = order.payment_method === 'cash_on_pickup' ? 'cash' : 'card'

  const { error } = await admin.from('revenue_point_sales').insert({
    tenant_id:        order.tenant_id,
    revenue_point_id: pointId,
    description:      `Food order ${order.order_ref ?? order.id.slice(0, 8)} (${order.customer_kind})`,
    quantity:         1,
    unit_price:       order.total_pesewas,
    total_amount:     order.total_pesewas,
    payment_method:   paymentMethod,
    reference:        order.id,
    occupant_id:      order.occupant_id,
    sold_at:          order.picked_up_at ?? new Date().toISOString(),
  })
  if (error) {
    console.error('[food revenue] insert sale failed', error)
  }
}

/**
 * Defensive reverse — only runs if a sale row exists for this order.
 * Today the state machine doesn't allow cancel-after-picked-up, so this
 * should be a no-op. Kept so future flows (manual admin reversal, refund
 * back-out) have a clean path.
 */
export async function reverseFoodSale(orderId: string, tenantId: string): Promise<void> {
  if (!orderId || !tenantId) return
  const admin = createTenantAdminClient(tenantId) as any
  const { error } = await admin
    .from('revenue_point_sales')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('reference', orderId)
  if (error) {
    console.error('[food revenue] reverse sale failed', error)
  }
}
