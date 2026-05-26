import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getOccupantSession } from '@/lib/auth/occupant-session'
import { createTenantAdminClient } from '@/lib/supabase/tenant-admin'
import { placeOrder } from '@/lib/food/orders'
import { sendPushToUsers } from '@/lib/push'
import { initializeTransaction } from '@/lib/paystack'

const schema = z.object({
  payment_method: z.enum(['online', 'cash_on_pickup']),
  notes:          z.string().max(280).nullable().optional(),
})

const KITCHEN_ROLES = ['owner','manager','housekeeper','receptionist'] as const

async function pingKitchen(tenantId: string, orderRef: string, orderId: string) {
  const admin = createTenantAdminClient(tenantId) as any
  const { data: members } = await admin
    .from('tenant_members')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .in('role', [...KITCHEN_ROLES])
  const userIds = ((members ?? []) as any[]).map(m => m.user_id as string)
  if (userIds.length === 0) return
  await sendPushToUsers(tenantId, userIds, {
    title: 'New food order',
    body:  `${orderRef} · placed`,
    url:   `/food/orders`,
  }).catch(err => console.error('[food order push]', err))
}

export async function POST(req: NextRequest) {
  const session = await getOccupantSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const json   = await req.json().catch(() => null)
  const parsed = schema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 422 })

  const admin = createTenantAdminClient(session.tenantId) as any
  const { data: tenant } = await admin
    .from('tenants')
    .select('food_orders_enabled, paystack_subaccount_code')
    .eq('id', session.tenantId)
    .maybeSingle()
  if (!tenant?.food_orders_enabled) return NextResponse.json({ error: 'Food ordering disabled' }, { status: 403 })

  if (parsed.data.payment_method === 'online' && !tenant.paystack_subaccount_code) {
    return NextResponse.json({ error: 'Online payment not configured for this hostel' }, { status: 400 })
  }

  const { data: booking } = await admin
    .from('bookings')
    .select('id')
    .eq('tenant_id', session.tenantId)
    .eq('occupant_id', session.occupantId)
    .in('status', ['checked_in','confirmed'])
    .order('created_at', { ascending: false })
    .limit(1).maybeSingle()

  const result = await placeOrder({
    tenantId:      session.tenantId,
    occupantId:    session.occupantId,
    bookingId:     booking?.id ?? null,
    paymentMethod: parsed.data.payment_method,
    notes:         parsed.data.notes ?? null,
    channel:       'resident',
  })
  if ('error' in result) {
    const status = (result as any).failed ? 409 : 400
    return NextResponse.json(result, { status })
  }
  const order = result.order

  if (parsed.data.payment_method === 'cash_on_pickup') {
    pingKitchen(session.tenantId, order.order_ref, order.id).catch(() => {})
    return NextResponse.json({ id: order.id, order_ref: order.order_ref }, { status: 201 })
  }

  // Online: init Paystack
  const { data: occ } = await admin
    .from('occupants')
    .select('email, phone')
    .eq('id', session.occupantId)
    .maybeSingle()

  const email = (occ?.email as string | null) ?? `${session.occupantId}@occupant.local`

  const init = await initializeTransaction({
    email,
    amountPesewas: order.total_pesewas,
    reference:     order.id,
    callbackUrl:   `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/occupant-portal/food/orders/${order.id}`,
    subaccount:    tenant.paystack_subaccount_code,
    metadata:      {
      source:    'food_order',
      order_id:  order.id,
      tenant_id: session.tenantId,
      order_ref: order.order_ref,
    },
  }).catch(err => {
    console.error('[food paystack init]', err)
    return null
  })

  if (!init?.authorizationUrl) {
    // Roll back the order to keep state consistent
    await admin.from('food_orders').delete().eq('id', order.id)
    return NextResponse.json({ error: 'Paystack init failed' }, { status: 500 })
  }

  return NextResponse.json({
    id:                order.id,
    order_ref:         order.order_ref,
    authorization_url: init.authorizationUrl,
  }, { status: 201 })
}
