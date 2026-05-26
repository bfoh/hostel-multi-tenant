import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyWebhookSignature } from '@/lib/paystack-webhook'
import { findPlanByCode } from '@/lib/platform-plans'

/**
 * Unified Paystack webhook.
 *
 * Handles both flows on the single platform merchant:
 *   • Flow A (platform subscriptions) — subscription.create, invoice.*,
 *     subscription.disable / not_renew, charge.success with
 *     source=platform_subscription metadata.
 *   • Flow B (guest payments)         — charge.success with payment_id metadata.
 *
 * Every delivery is logged to paystack_events first (idempotency). Only
 * successfully signed payloads are processed; failures write the error
 * back to paystack_events.error so we can debug without re-running.
 */
export async function POST(req: NextRequest) {
  const signature = req.headers.get('x-paystack-signature') ?? ''
  const rawBody   = await req.text()

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: PaystackWebhookPayload
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // ── Idempotent ledger ────────────────────────────────────────────────────
  // Paystack payloads include a top-level `id` (integer) on most events.
  // Coerce to string for our text-typed event_id column.
  const eventId   = event.id != null ? String(event.id) : null
  const eventType = event.event
  const reference = typeof event.data?.reference === 'string' ? event.data.reference : null
  const tenantId  = extractTenantId(event)

  const { data: ledgerRow, error: ledgerErr } = await supabase
    .from('paystack_events')
    .insert({
      event_id:   eventId,
      event_type: eventType,
      tenant_id:  tenantId,
      reference,
      payload:    event as any,
    })
    .select('id')
    .single()

  // Dedup: if event_id already present, we get a unique-violation → treat as ok
  if (ledgerErr && !/duplicate|already exists/i.test(ledgerErr.message)) {
    return NextResponse.json({ error: 'Ledger write failed' }, { status: 500 })
  }
  if (ledgerErr) return NextResponse.json({ ok: true, deduped: true })

  try {
    await dispatch(event, supabase)
    await supabase
      .from('paystack_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('id', ledgerRow!.id)
  } catch (err: any) {
    await supabase
      .from('paystack_events')
      .update({ error: err.message ?? String(err) })
      .eq('id', ledgerRow!.id)
    return NextResponse.json({ error: err.message ?? 'Handler failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// ═══════════════════════════════════════════════════════════════════════════
// Dispatcher
// ═══════════════════════════════════════════════════════════════════════════

async function dispatch(event: PaystackWebhookPayload, supabase: AdminClient) {
  switch (event.event) {
    case 'charge.success':
      return handleChargeSuccess(event, supabase)

    case 'subscription.create':
      return handleSubscriptionCreate(event, supabase)

    case 'invoice.create':
    case 'invoice.update':
      return handleInvoiceUpdate(event, supabase)

    case 'invoice.payment_failed':
      return handleInvoiceFailed(event, supabase)

    case 'subscription.disable':
    case 'subscription.not_renew':
      return handleSubscriptionDisable(event, supabase)

    case 'charge.dispute.create':
    case 'charge.dispute.remind':
    case 'charge.dispute.resolve':
      return handleDispute(event, supabase)

    default:
      return // no-op
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// charge.success — branches on metadata.source
// ═══════════════════════════════════════════════════════════════════════════

async function handleChargeSuccess(event: PaystackWebhookPayload, supabase: AdminClient) {
  const { reference, metadata } = event.data
  const source = metadata?.source

  // Platform subscription first charge — nothing to record here; the
  // subscription.create event owns the tenant_subscriptions row.
  if (source === 'platform_subscription') return

  // Walk-in sale — QR-driven payment at gym / sports / laundry / etc.
  // Inserts a revenue_point_sales row + upserts the visitor (auto-linked
  // to an occupant when the phone matches). Idempotent by reference.
  if (source === 'walkin_sale') {
    const md = metadata as any
    const tenantId = md?.tenant_id as string | undefined
    if (!tenantId || !md?.revenue_point_id || !md?.amount) return

    const adminAny = supabase as any

    const { data: existing } = await adminAny
      .from('revenue_point_sales')
      .select('id')
      .eq('reference', reference)
      .maybeSingle()
    if (existing) return

    // 1) Upsert visitor by (tenant_id, phone). Link to occupant when phone matches.
    let visitorId: string | null = null
    if (md.phone) {
      const { data: occ } = await adminAny
        .from('occupants')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('phone', md.phone)
        .maybeSingle()

      const { data: visitor } = await adminAny
        .from('revenue_point_visitors')
        .upsert(
          {
            tenant_id:   tenantId,
            phone:       md.phone,
            first_name:  md.first_name ?? null,
            last_name:   md.last_name ?? null,
            email:       md.email ?? null,
            occupant_id: occ?.id ?? null,
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: 'tenant_id,phone' },
        )
        .select('id, visit_count, total_spend')
        .single()

      if (visitor) {
        visitorId = visitor.id
        await adminAny
          .from('revenue_point_visitors')
          .update({
            visit_count: (visitor.visit_count ?? 0) + 1,
            total_spend: (visitor.total_spend ?? 0) + (md.amount as number),
          })
          .eq('id', visitor.id)
      }
    }

    // 2) Map Paystack channel → payment_method enum used by ledger trigger
    const channel = event.data.channel
    const paymentMethod =
      channel === 'mobile_money' ? 'momo_mtn' :
      channel === 'card'         ? 'card'     :
      channel === 'bank' || channel === 'bank_transfer' ? 'bank_transfer' :
      'card'

    // 3) Initial status — laundry tracks fulfilment, others auto-complete
    const initialStatus =
      md.revenue_point_type === 'laundry' ? 'received' : 'completed'

    await adminAny
      .from('revenue_point_sales')
      .insert({
        tenant_id:        tenantId,
        revenue_point_id: md.revenue_point_id,
        item_id:          null,
        description:      md.description ?? 'Walk-in sale',
        quantity:         1,
        unit_price:       md.amount,
        total_amount:     md.amount,
        payment_method:   paymentMethod,
        reference,
        customer_name:    [md.first_name, md.last_name].filter(Boolean).join(' ') || null,
        visitor_id:       visitorId,
        duration_minutes: md.duration_minutes ?? null,
        weight_kg:        md.weight_kg ?? null,
        court_id:         md.court_id ?? null,
        entry_token:      md.entry_token ?? null,
        status:           initialStatus,
      })

    // Fire SMS receipt (non-blocking).
    if (md.phone && md.entry_token) {
      try {
        const { sendWalkinReceipt } = await import('@/lib/sms')
        const { data: t } = await adminAny
          .from('tenants').select('name').eq('id', tenantId).single()
        const hostelName = t?.name ?? 'Your hostel'
        const amountGHS  = `GH₵ ${((md.amount as number) / 100).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`

        // Laundry pickup window
        let readyAt: string | undefined
        if (md.revenue_point_type === 'laundry') {
          const { data: rp } = await adminAny
            .from('revenue_points').select('public_config').eq('id', md.revenue_point_id).single()
          const hours = Number(rp?.public_config?.turnaround_hours ?? 24)
          const ready = new Date(Date.now() + hours * 3600_000)
          readyAt = ready.toLocaleString('en-GH', { dateStyle: 'medium', timeStyle: 'short' })
        }

        const flowType: 'gym' | 'sports' | 'laundry' =
          md.revenue_point_type === 'sports'  ? 'sports'  :
          md.revenue_point_type === 'laundry' ? 'laundry' :
                                                'gym'

        await sendWalkinReceipt({
          phone:       md.phone,
          firstName:   md.first_name ?? 'there',
          hostelName,
          type:        flowType,
          amountGHS,
          token:       md.entry_token,
          description: md.description,
          weightKg:    md.weight_kg != null ? String(md.weight_kg) : undefined,
          readyAt,
          tenantId,
        })
      } catch (err) {
        console.error('[walkin_sale sms]', err)
      }
    }
    return
  }

  // POS sale — pay link issued at a revenue point. Insert sale row on
  // success. Idempotent by reference unique check.
  if (source === 'pos_sale') {
    const md = metadata as any
    const tenantId = md?.tenant_id as string | undefined
    if (!tenantId || !md?.revenue_point_id || !md?.total_amount) return

    const adminAny = supabase as any
    const { data: existing } = await adminAny
      .from('revenue_point_sales')
      .select('id')
      .eq('reference', reference)
      .maybeSingle()
    if (existing) return

    // Map Paystack channel to our payment_method enum
    const channel = event.data.channel
    const method  =
      channel === 'mobile_money'  ? 'momo_mtn' :
      channel === 'card'          ? 'card'     :
      channel === 'bank' || channel === 'bank_transfer' ? 'bank_transfer' :
      (md.payment_method === 'mobile_money' ? 'momo_mtn'
       : md.payment_method === 'bank_transfer' ? 'bank_transfer'
       : 'card')

    await adminAny
      .from('revenue_point_sales')
      .insert({
        tenant_id:        tenantId,
        revenue_point_id: md.revenue_point_id,
        item_id:          md.item_id ?? null,
        description:      md.description,
        quantity:         md.quantity ?? 1,
        unit_price:       md.unit_price ?? md.total_amount,
        total_amount:     md.total_amount,
        payment_method:   method,
        reference,
        customer_name:    md.customer_name ?? null,
        occupant_id:      md.occupant_id ?? null,
        sold_by:          md.sold_by ?? null,
      })
    return
  }

  // Installment — pay link for a single payment_plan_installments row.
  // Marks installment paid and increments booking.paid_amount. Idempotent
  // by checking installment.status.
  if (source === 'installment') {
    const tenantId       = (metadata as any)?.tenant_id as string | undefined
    const installmentId  = (metadata as any)?.installment_id as string | undefined
    const bookingId      = (metadata as any)?.booking_id as string | undefined
    const amountPesewas  = (metadata as any)?.amount as number | undefined

    if (!tenantId || !installmentId || !bookingId || !amountPesewas) return

    const adminAny = supabase as any

    const { data: existing } = await adminAny
      .from('payment_plan_installments')
      .select('id, status, amount')
      .eq('id', installmentId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!existing || existing.status === 'paid') return

    const { data: updated } = await adminAny
      .from('payment_plan_installments')
      .update({
        status:         'paid',
        paid_at:        new Date().toISOString(),
        payment_method: inferMethodFromChannel(event.data.channel),
        reference,
      })
      .eq('id', installmentId)
      .eq('tenant_id', tenantId)
      .neq('status', 'paid')
      .select('amount')
      .single()

    if (updated) {
      const { data: bk } = await adminAny
        .from('bookings')
        .select('paid_amount, final_amount')
        .eq('id', bookingId)
        .single()
      if (bk) {
        const newPaid = (bk.paid_amount as number) + amountPesewas
        const newPaymentStatus = newPaid >= bk.final_amount ? 'paid'
          : newPaid > 0 ? 'partial' : 'unpaid'
        await adminAny
          .from('bookings')
          .update({ paid_amount: newPaid, payment_status: newPaymentStatus })
          .eq('id', bookingId)
      }
    }
    return
  }

  // Damage deposit — pay link issued by staff/guest. Insert deposit row on
  // success, idempotent on (booking_id) unique constraint.
  if (source === 'damage_deposit') {
    const tenantId    = (metadata as any)?.tenant_id as string | undefined
    const bookingId   = (metadata as any)?.booking_id as string | undefined
    const occupantId  = (metadata as any)?.occupant_id as string | undefined
    const depositAmt  = (metadata as any)?.deposit_amount as number | undefined

    if (!tenantId || !bookingId || !occupantId || !depositAmt) return

    const adminAny = supabase as any
    const { data: existing } = await adminAny
      .from('damage_deposits')
      .select('id')
      .eq('booking_id', bookingId)
      .maybeSingle()

    if (existing) return // idempotent — deposit already on file

    await adminAny
      .from('damage_deposits')
      .insert({
        tenant_id:    tenantId,
        booking_id:   bookingId,
        occupant_id:  occupantId,
        amount:       depositAmt,
        method:       inferMethodFromChannel(event.data.channel),
        reference:    reference,
        collected_at: new Date().toISOString(),
        status:       'held',
        notes:        'Paid online via Paystack pay link',
      })
    return
  }

  // Food orders — tenant-side ledger, not booking_payments. Branch first so
  // the booking_payments fallback below never accidentally matches.
  if (source === 'food_order') {
    const orderId  = (metadata as any)?.order_id as string | undefined
    const tenantId = (metadata as any)?.tenant_id as string | undefined
    if (!orderId || !tenantId) return

    const adminAny = supabase as any
    await adminAny
      .from('food_orders')
      .update({
        paid_at:            new Date().toISOString(),
        paystack_reference: reference,
      })
      .eq('id', orderId)
      .eq('tenant_id', tenantId)

    // Notify kitchen now that payment is confirmed
    const { data: members } = await adminAny
      .from('tenant_members')
      .select('user_id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .in('role', ['owner','manager','housekeeper','receptionist'])
    const userIds = ((members ?? []) as any[]).map((m: any) => m.user_id as string)
    if (userIds.length > 0) {
      try {
        const { sendPushToUsers } = await import('@/lib/push')
        await sendPushToUsers(tenantId, userIds, {
          title: 'New paid food order',
          body:  `Order ${(metadata as any)?.order_ref ?? orderId.slice(0, 8)} · paid online`,
          url:   '/food/orders',
        })
      } catch (err) {
        console.error('[food order webhook push]', err)
      }
    }
    return
  }

  // Otherwise: guest/occupant payment against a booking.
  let paymentId: string | undefined = metadata?.payment_id

  if (!paymentId && reference) {
    const { data: byRef } = await supabase
      .from('booking_payments')
      .select('id')
      .eq('reference', reference)
      .eq('status', 'pending')
      .maybeSingle()
    paymentId = byRef?.id
  }

  if (!paymentId) {
    // Also handle hosted-transaction callback that recorded payment via
    // paystack_reference column
    if (reference) {
      const { data: byPaystackRef } = await supabase
        .from('booking_payments')
        .select('id')
        .eq('paystack_reference', reference)
        .eq('status', 'pending')
        .maybeSingle()
      paymentId = byPaystackRef?.id
    }
  }

  if (!paymentId) return  // unknown charge — log only

  const { data: payment } = await supabase
    .from('booking_payments')
    .update({
      status:  'success',
      paid_at: new Date().toISOString(),
    })
    .eq('id', paymentId)
    .eq('status', 'pending')
    .select('id, booking_id, amount')
    .single()

  if (payment) {
    await supabase
      .from('bookings')
      .update({ updated_at: new Date().toISOString() } as any)
      .eq('id', payment.booking_id)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// subscription.create — initial activation after first charge
// ═══════════════════════════════════════════════════════════════════════════

async function handleSubscriptionCreate(event: PaystackWebhookPayload, supabase: AdminClient) {
  const data = event.data
  const customerCode    = data.customer?.customer_code
  const subscriptionCode = data.subscription_code
  const emailToken      = data.email_token
  const planCode        = data.plan?.plan_code
  const nextPaymentDate = data.next_payment_date ?? null
  const createdAt       = data.createdAt ?? data.created_at ?? null
  const amount          = data.amount ?? data.plan?.amount ?? 0

  if (!customerCode || !subscriptionCode || !planCode) return

  // Resolve tenant: prefer metadata.tenant_id; fall back to paystack_customer_id
  let tenantId = extractTenantId(event)
  if (!tenantId) {
    const { data: t } = await supabase
      .from('tenants')
      .select('id')
      .eq('paystack_customer_id', customerCode)
      .maybeSingle()
    tenantId = t?.id ?? null
  }
  if (!tenantId) return

  const plan = findPlanByCode(planCode)

  await supabase
    .from('tenant_subscriptions')
    .upsert(
      {
        tenant_id:                   tenantId,
        paystack_customer_code:      customerCode,
        paystack_plan_code:          planCode,
        paystack_subscription_code:  subscriptionCode,
        paystack_email_token:        emailToken ?? null,
        plan_name:                   plan?.name ?? data.plan?.name ?? 'starter',
        amount,
        currency:                    data.plan?.currency ?? 'GHS',
        status:                      'active',
        current_period_start:        createdAt,
        current_period_end:          nextPaymentDate,
        next_payment_at:             nextPaymentDate,
        last_payment_at:             new Date().toISOString(),
      },
      { onConflict: 'paystack_subscription_code' },
    )
}

// ═══════════════════════════════════════════════════════════════════════════
// invoice.* — renewal cycle
// ═══════════════════════════════════════════════════════════════════════════

async function handleInvoiceUpdate(event: PaystackWebhookPayload, supabase: AdminClient) {
  const subscriptionCode = event.data.subscription?.subscription_code
  if (!subscriptionCode) return

  const rawStatus       = event.data.status
  const paid            = !!event.data.paid
  const nextPaymentDate = event.data.subscription?.next_payment_date ?? null

  const update: {
    next_payment_at?:    string
    current_period_end?: string
    status?:             'active' | 'past_due'
    last_payment_at?:    string
  } = {}

  if (nextPaymentDate) {
    update.next_payment_at    = nextPaymentDate
    update.current_period_end = nextPaymentDate
  }
  if (paid) {
    update.status          = 'active'
    update.last_payment_at  = new Date().toISOString()
  }
  if (rawStatus === 'failed') update.status = 'past_due'

  if (Object.keys(update).length === 0) return

  await supabase
    .from('tenant_subscriptions')
    .update(update)
    .eq('paystack_subscription_code', subscriptionCode)
}

async function handleInvoiceFailed(event: PaystackWebhookPayload, supabase: AdminClient) {
  const subscriptionCode = event.data.subscription?.subscription_code
  if (!subscriptionCode) return
  await supabase
    .from('tenant_subscriptions')
    .update({ status: 'past_due' })
    .eq('paystack_subscription_code', subscriptionCode)
}

// ═══════════════════════════════════════════════════════════════════════════
// subscription.disable / not_renew
// ═══════════════════════════════════════════════════════════════════════════

async function handleSubscriptionDisable(event: PaystackWebhookPayload, supabase: AdminClient) {
  const subscriptionCode = event.data.subscription_code
  if (!subscriptionCode) return
  await supabase
    .from('tenant_subscriptions')
    .update({
      status:      'canceled',
      canceled_at: new Date().toISOString(),
    })
    .eq('paystack_subscription_code', subscriptionCode)
}

// ═══════════════════════════════════════════════════════════════════════════
// charge.dispute.* — flag but don't auto-refund
// ═══════════════════════════════════════════════════════════════════════════

async function handleDispute(_event: PaystackWebhookPayload, _supabase: AdminClient) {
  // Intentionally left light — dispute resolution is human-in-the-loop.
  // The paystack_events row preserves the full payload for admin review.
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function extractTenantId(event: PaystackWebhookPayload): string | null {
  const md = event.data?.metadata
  if (md && typeof md === 'object' && typeof md.tenant_id === 'string') return md.tenant_id
  return null
}

function inferMethodFromChannel(channel: string | undefined): string {
  switch (channel) {
    case 'mobile_money': return 'momo_mtn'
    case 'card':         return 'card'
    case 'bank':
    case 'bank_transfer': return 'bank_transfer'
    default:             return 'card'
  }
}

// ── Types ──────────────────────────────────────────────────────────────────

type AdminClient = ReturnType<typeof createAdminClient>

interface PaystackWebhookPayload {
  id?: number | string
  event: string
  data: {
    reference?: string
    status?: string
    amount?: number
    paid?: boolean
    channel?: string
    metadata?: Record<string, any> | null
    customer?: { customer_code?: string; email?: string }
    subscription?: {
      subscription_code?: string
      next_payment_date?: string
      status?: string
    }
    subscription_code?: string
    email_token?: string
    plan?: {
      plan_code?: string
      name?: string
      amount?: number
      currency?: string
      interval?: string
    }
    plan_code?: string
    next_payment_date?: string
    createdAt?: string
    created_at?: string
    [key: string]: any
  }
}
