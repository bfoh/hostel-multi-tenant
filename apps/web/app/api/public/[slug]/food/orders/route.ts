import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { placeOrder } from '@/lib/food/orders'
import { findOrCreateGuestOccupant, generateTrackingToken } from '@/lib/food/guest'
import { initializeTransaction } from '@/lib/paystack'
import { sendPushToUsers } from '@/lib/push'
import { sendFoodOrderPlacedGuest } from '@/lib/sms'

const KITCHEN_ROLES = ['owner','manager','housekeeper','receptionist'] as const

const lineSchema = z.object({
  menu_item_id: z.string().uuid(),
  quantity:     z.number().int().min(1).max(10),
})

const schema = z.object({
  channel:        z.enum(['walk_in', 'online']),
  first_name:     z.string().min(1).max(80),
  last_name:      z.string().min(1).max(80),
  phone:          z.string().min(7).max(30),
  email:          z.string().email().max(200).nullable().optional(),
  items:          z.array(lineSchema).min(1).max(50),
  payment_method: z.enum(['online', 'cash_on_pickup']),
  notes:          z.string().max(280).nullable().optional(),
  table_label:    z.string().max(40).nullable().optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const admin = createAdminClient() as any

  const { data: tenant } = await admin
    .from('tenants')
    .select('id, slug, name, food_orders_enabled, paystack_subaccount_code, custom_domain')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()
  if (!tenant) return NextResponse.json({ error: 'Hostel not found' }, { status: 404 })
  if (!tenant.food_orders_enabled) {
    return NextResponse.json({ error: 'Food ordering disabled' }, { status: 403 })
  }

  const json   = await req.json().catch(() => null)
  const parsed = schema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid', details: parsed.error.flatten() }, { status: 422 })
  const body = parsed.data

  // Online channel must pay online — block cash for remote customers
  if (body.channel === 'online' && body.payment_method !== 'online') {
    return NextResponse.json({ error: 'Online channel requires online payment' }, { status: 400 })
  }
  if (body.payment_method === 'online' && !tenant.paystack_subaccount_code) {
    return NextResponse.json({ error: 'Online payment not configured for this hostel' }, { status: 400 })
  }

  // Find-or-create guest occupant by phone
  const guest = await findOrCreateGuestOccupant({
    tenantId:  tenant.id,
    firstName: body.first_name,
    lastName:  body.last_name,
    phone:     body.phone,
    email:     body.email ?? null,
  })
  if ('error' in guest) {
    return NextResponse.json({ error: guest.error }, { status: 500 })
  }

  const trackingToken = generateTrackingToken()

  const result = await placeOrder({
    tenantId:      tenant.id,
    occupantId:    guest.id,
    bookingId:     null,
    paymentMethod: body.payment_method,
    notes:         body.notes ?? null,
    channel:       body.channel,
    tableLabel:    body.channel === 'walk_in' ? (body.table_label ?? null) : null,
    trackingToken,
    cartLines:     body.items.map(i => ({ menu_item_id: i.menu_item_id, quantity: i.quantity })),
  })
  if ('error' in result) {
    const status = (result as any).failed ? 409 : 400
    return NextResponse.json(result, { status })
  }
  const order = result.order

  const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const trackingUrl = `${appUrl}/order/${slug}/orders/${order.id}?token=${trackingToken}`

  // Cash-on-pickup (walk-in) — notify kitchen now + SMS guest tracking
  if (body.payment_method === 'cash_on_pickup') {
    pingKitchen(tenant.id, order.order_ref, order.id).catch(() => {})
    sendFoodOrderPlacedGuest({
      phone:       body.phone,
      firstName:   body.first_name,
      orderRef:    order.order_ref,
      trackingUrl,
      hostelName:  tenant.name ?? 'Hostel',
      tenantId:    tenant.id,
    }).catch((err: unknown) => console.error('[guest order placed sms]', err))
    return NextResponse.json({
      id:             order.id,
      order_ref:      order.order_ref,
      tracking_token: trackingToken,
    }, { status: 201 })
  }

  // Online — init Paystack
  const init = await initializeTransaction({
    email:         body.email ?? `${body.phone.replace(/\D/g, '')}@guest.local`,
    amountPesewas: order.total_pesewas,
    reference:     order.id,
    callbackUrl:   `${appUrl}/order/${slug}/orders/${order.id}?token=${trackingToken}`,
    subaccount:    tenant.paystack_subaccount_code,
    metadata:      {
      source:     'food_order',
      order_id:   order.id,
      tenant_id:  tenant.id,
      order_ref:  order.order_ref,
      channel:    body.channel,
    },
  }).catch((err: unknown) => {
    console.error('[guest paystack init]', err)
    return null
  })

  if (!init?.authorizationUrl) {
    await admin.from('food_orders').delete().eq('id', order.id)
    return NextResponse.json({ error: 'Paystack init failed' }, { status: 500 })
  }

  // SMS the tracking URL up front so guest can monitor while paying
  sendFoodOrderPlacedGuest({
    phone:       body.phone,
    firstName:   body.first_name,
    orderRef:    order.order_ref,
    trackingUrl,
    hostelName:  tenant.name ?? 'Hostel',
    tenantId:    tenant.id,
  }).catch((err: unknown) => console.error('[guest order placed sms]', err))

  return NextResponse.json({
    id:                order.id,
    order_ref:         order.order_ref,
    tracking_token:    trackingToken,
    authorization_url: init.authorizationUrl,
  }, { status: 201 })
}

async function pingKitchen(tenantId: string, orderRef: string, orderId: string) {
  const admin = createAdminClient() as any
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
  }).catch((err: unknown) => console.error('[guest order kitchen push]', err))
}
