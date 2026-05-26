import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getServerTenantId } from '@/lib/auth/tenant'
import { requireTenantRole } from '@/lib/auth/tenant-role'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { advanceStatus } from '@/lib/food/orders'
import { refundFoodOrder } from '@/lib/food/refund'
import { recordFoodSale, reverseFoodSale } from '@/lib/food/revenue'
import { sendPushToUsers } from '@/lib/push'
import { sendFoodOrderReady, sendFoodOrderCancelled } from '@/lib/sms'

const schema = z.object({
  status: z.enum(['preparing','ready','picked_up','cancelled']),
  reason: z.string().max(280).nullable().optional(),
})

const KITCHEN_ROLES = ['owner','manager','housekeeper','receptionist'] as const

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })
  const ctx = await requireTenantRole(tenantId, KITCHEN_ROLES)
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  const json   = await req.json().catch(() => null)
  const parsed = schema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 422 })

  const result = await advanceStatus(id, tenantId, parsed.data.status, parsed.data.reason ?? undefined)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })

  const order = result.order
  const admin = await createTenantAdminClientFromHeaders() as any
  const { data: occ } = await admin
    .from('occupants')
    .select('user_id, phone, first_name')
    .eq('id', order.occupant_id)
    .maybeSingle()
  const { data: tenantRow } = await admin
    .from('tenants')
    .select('name, food_ready_sms')
    .eq('id', tenantId)
    .maybeSingle()
  const hostelName = tenantRow?.name ?? 'Hostel'

  if (parsed.data.status === 'ready') {
    if (occ?.user_id) {
      sendPushToUsers([occ.user_id], {
        title: 'Order ready for pickup',
        body:  `Order ${order.order_ref ?? id.slice(0, 8)} is ready`,
        url:   `/occupant-portal/food/orders/${id}`,
      }).catch((err: unknown) => console.error('[food ready push]', err))
    }
    if (tenantRow?.food_ready_sms && occ?.phone && occ?.first_name && order.order_ref) {
      sendFoodOrderReady({
        phone:      occ.phone,
        firstName:  occ.first_name,
        orderRef:   order.order_ref,
        hostelName,
        tenantId,
      }).catch((err: unknown) => console.error('[food ready sms]', err))
    }
  }

  if (parsed.data.status === 'cancelled') {
    if (occ?.user_id) {
      sendPushToUsers([occ.user_id], {
        title: 'Order cancelled',
        body:  parsed.data.reason ?? 'Cancelled by hostel',
        url:   `/occupant-portal/food/orders/${id}`,
      }).catch((err: unknown) => console.error('[food cancelled push]', err))
    }
    if (occ?.phone && occ?.first_name && order.order_ref) {
      sendFoodOrderCancelled({
        phone:      occ.phone,
        firstName:  occ.first_name,
        orderRef:   order.order_ref,
        reason:     parsed.data.reason ?? 'cancelled',
        hostelName,
        tenantId,
      }).catch((err: unknown) => console.error('[food cancelled sms]', err))
    }
    if (order.payment_method === 'online' && order.paid_at && order.paystack_reference) {
      refundFoodOrder(order.paystack_reference, order.total_pesewas)
        .catch((err: unknown) => console.error('[food refund]', err))
    }
    // Defensive — state machine prevents cancel-after-picked-up but keeps the
    // accounting path clean if a future flow allows it.
    reverseFoodSale(id, tenantId)
      .catch((err: unknown) => console.error('[food revenue reverse]', err))
  }

  if (parsed.data.status === 'picked_up') {
    recordFoodSale({
      id,
      tenant_id:      tenantId,
      occupant_id:    order.occupant_id ?? null,
      order_ref:      order.order_ref ?? null,
      total_pesewas:  order.total_pesewas,
      payment_method: order.payment_method,
      customer_kind:  (order.customer_kind ?? 'resident') as 'resident' | 'walk_in' | 'online',
      picked_up_at:   new Date().toISOString(),
    }).catch((err: unknown) => console.error('[food revenue record]', err))
  }

  return NextResponse.json({ ok: true })
}
