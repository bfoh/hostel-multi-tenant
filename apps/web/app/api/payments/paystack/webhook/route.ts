import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyWebhookSignature } from '@/lib/paystack'
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
