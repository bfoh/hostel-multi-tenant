import { NextResponse, type NextRequest } from 'next/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { verifyTransaction, listSubscriptions } from '@/lib/paystack'
import { findPlanByCode } from '@/lib/platform-plans'

/**
 * GET /api/billing/callback?reference=...
 *
 * Post-charge landing page. Verifies the transaction, then eagerly populates
 * tenant_subscriptions from Paystack (customer_code + plan_code) so the
 * billing page reflects the new plan immediately — without waiting for the
 * subscription.create webhook, which may lag by seconds or fail silently.
 *
 * The webhook handler remains authoritative for lifecycle updates; this is
 * purely a freshness optimization. Upserts are idempotent.
 */
export async function GET(req: NextRequest) {
  const reference = req.nextUrl.searchParams.get('reference')
                 ?? req.nextUrl.searchParams.get('trxref')

  const host   = req.headers.get('host') ?? 'localhost:3000'
  const proto  = host.includes('localhost') ? 'http' : 'https'
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`

  if (!reference) {
    return NextResponse.redirect(new URL('/settings/billing?sub=error', origin))
  }

  try {
    const data = await verifyTransaction(reference)
    if (data.status !== 'success') {
      return NextResponse.redirect(new URL('/settings/billing?sub=failed', origin))
    }

    const source    = data.metadata?.source
    const tenantId  = typeof data.metadata?.tenant_id === 'string' ? data.metadata.tenant_id : null
    const planCode  = typeof data.plan === 'string' ? data.plan : null
    const customerCode = data.customer?.customer_code

    if (source === 'platform_subscription' && tenantId && planCode && customerCode) {
      try {
        const subs = await listSubscriptions({ customer: customerCode, plan: planCode })
        const sub  = subs[0]
        if (sub) {
          const plan = findPlanByCode(sub.plan.plan_code)
          const admin = await createTenantAdminClientFromHeaders()
          await admin
            .from('tenant_subscriptions')
            .upsert(
              {
                tenant_id:                  tenantId,
                paystack_customer_code:     sub.customer.customer_code,
                paystack_plan_code:         sub.plan.plan_code,
                paystack_subscription_code: sub.subscription_code,
                paystack_email_token:       sub.email_token,
                plan_name:                  plan?.name ?? sub.plan.name ?? 'starter',
                billing_interval:           plan?.interval ?? 'monthly',
                amount:                     sub.amount ?? sub.plan.amount ?? 0,
                currency:                   sub.plan.currency ?? 'GHS',
                status:                     'active',
                current_period_start:       sub.createdAt ?? sub.created_at ?? new Date().toISOString(),
                current_period_end:         sub.next_payment_date ?? null,
                next_payment_at:            sub.next_payment_date ?? null,
                last_payment_at:            new Date().toISOString(),
              },
              { onConflict: 'paystack_subscription_code' },
            )
        }
      } catch {
        // Non-fatal: webhook will still sync.
      }
    }

    return NextResponse.redirect(new URL('/settings/billing?sub=success', origin))
  } catch {
    return NextResponse.redirect(new URL('/settings/billing?sub=error', origin))
  }
}
