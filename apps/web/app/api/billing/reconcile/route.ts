import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { listSubscriptions } from '@/lib/paystack'
import { findPlanByCode } from '@/lib/platform-plans'

/**
 * POST /api/billing/reconcile
 *
 * Re-sync tenant_subscriptions from Paystack for the current tenant. Handy
 * when the subscription.create webhook was missed (e.g. route not yet in
 * middleware BYPASS_PATHS at the time of subscribe).
 *
 * Looks up the tenant's paystack_customer_id → lists active subscriptions
 * on Paystack → upserts the freshest one into tenant_subscriptions.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 400 })

  if (!process.env.PAYSTACK_SECRET_KEY) {
    return NextResponse.json({ error: 'Billing not configured' }, { status: 503 })
  }

  const admin = await createTenantAdminClientFromHeaders()

  const { data: tenant } = await admin
    .from('tenants')
    .select('id, paystack_customer_id')
    .eq('id', tenantId)
    .single()

  if (!tenant?.paystack_customer_id) {
    return NextResponse.json({ error: 'No Paystack customer for this tenant' }, { status: 404 })
  }

  let subs
  try {
    subs = await listSubscriptions({ customer: tenant.paystack_customer_id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Paystack error' }, { status: 502 })
  }

  // Prefer an active/non-cancelled subscription; else take the newest.
  const sorted = [...subs].sort((a, b) => {
    const aDate = new Date(a.createdAt ?? a.created_at ?? 0).getTime()
    const bDate = new Date(b.createdAt ?? b.created_at ?? 0).getTime()
    return bDate - aDate
  })
  const sub = sorted.find((s) => s.status === 'active') ?? sorted[0]

  if (!sub) return NextResponse.json({ reconciled: false, reason: 'No subscriptions on Paystack' })

  const plan = findPlanByCode(sub.plan.plan_code)

  const status = sub.status === 'attention'
    ? 'past_due'
    : sub.status === 'cancelled' || sub.status === 'complete'
      ? 'canceled'
      : 'active'

  const { error: upsertErr } = await admin
    .from('tenant_subscriptions')
    .upsert(
      {
        tenant_id:                  tenantId,
        paystack_customer_code:     sub.customer.customer_code,
        paystack_plan_code:         sub.plan.plan_code,
        paystack_subscription_code: sub.subscription_code,
        paystack_email_token:       sub.email_token,
        plan_name:                  plan?.name ?? sub.plan.name ?? 'starter',
        amount:                     sub.amount ?? sub.plan.amount ?? 0,
        currency:                   sub.plan.currency ?? 'GHS',
        status,
        current_period_start:       sub.createdAt ?? sub.created_at ?? new Date().toISOString(),
        current_period_end:         sub.next_payment_date ?? null,
        next_payment_at:            sub.next_payment_date ?? null,
        last_payment_at:            new Date().toISOString(),
      },
      { onConflict: 'paystack_subscription_code' },
    )

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 })
  }

  return NextResponse.json({
    reconciled: true,
    plan_name:  plan?.name ?? sub.plan.name,
    status,
    subscription_code: sub.subscription_code,
  })
}
