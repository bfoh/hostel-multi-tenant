import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import {
  initializeTransaction,
  createCustomer,
  disableSubscription,
} from '@/lib/paystack'
import { getPlatformPlan, type PlatformPlanName } from '@/lib/platform-plans'
import { paymentLimiter, enforceRateLimit } from '@/lib/rate-limit'

const schema = z.object({
  plan: z.enum(['starter', 'growth']),
})

/**
 * POST /api/billing/switch-plan
 *
 * Switches a tenant from their current plan to a different one.
 * Paystack does not support in-place plan changes, so we:
 *   1. Cancel (disable) the current subscription on Paystack
 *   2. Mark the local subscription row as canceled
 *   3. Initialize a new Paystack transaction with the new plan attached
 *   4. Return the authorization_url for the user to complete payment
 *
 * On successful payment, Paystack auto-creates a new subscription and
 * fires subscription.create — our webhook handler picks that up.
 */
export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(paymentLimiter, req, 'billing-switch')
  if (limited) return limited

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 400 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid plan' }, { status: 422 })

  if (!process.env.PAYSTACK_SECRET_KEY) {
    return NextResponse.json({ error: 'Billing not configured' }, { status: 503 })
  }

  const newPlan = getPlatformPlan(parsed.data.plan as PlatformPlanName)
  if (!newPlan) return NextResponse.json({ error: 'Unknown plan' }, { status: 422 })
  if (!newPlan.planCode) {
    return NextResponse.json(
      { error: `Plan ${newPlan.name} is not linked to a Paystack plan code. Run the admin bootstrap first.` },
      { status: 503 },
    )
  }

  const admin = await createTenantAdminClientFromHeaders()

  // 1. Find the current active subscription
  const { data: currentSub } = await admin
    .from('tenant_subscriptions')
    .select('id, paystack_subscription_code, paystack_email_token, plan_name, status')
    .eq('tenant_id', tenantId)
    .in('status', ['trialing', 'active', 'past_due'])
    .maybeSingle()

  // Block if trying to switch to the same plan
  if (currentSub?.plan_name === parsed.data.plan) {
    return NextResponse.json({ error: 'Already on this plan' }, { status: 409 })
  }

  // 2. Cancel the current subscription on Paystack (if one exists)
  if (currentSub?.paystack_subscription_code && currentSub?.paystack_email_token) {
    try {
      await disableSubscription({
        code:  currentSub.paystack_subscription_code,
        token: currentSub.paystack_email_token,
      })
    } catch (err: any) {
      // If Paystack says subscription is already inactive, that's fine
      if (!err.message?.includes('already') && !err.message?.includes('inactive')) {
        return NextResponse.json({ error: `Failed to cancel current plan: ${err.message}` }, { status: 502 })
      }
    }

    // Mark local row as canceled
    await admin
      .from('tenant_subscriptions')
      .update({ status: 'canceled', canceled_at: new Date().toISOString() })
      .eq('id', currentSub.id)
  }

  // 3. Ensure Paystack customer exists
  const { data: tenant } = await admin
    .from('tenants')
    .select('id, name, billing_email, contact_email, paystack_customer_id')
    .eq('id', tenantId)
    .single()

  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const email = tenant.billing_email ?? (tenant as any).contact_email ?? user.email
  if (!email) {
    return NextResponse.json(
      { error: 'Set a billing email in Settings → Profile before subscribing.' },
      { status: 422 },
    )
  }

  let customerCode = tenant.paystack_customer_id
  if (!customerCode) {
    try {
      const customer = await createCustomer({
        email,
        firstName: tenant.name,
        metadata:  { tenant_id: tenantId },
      })
      customerCode = customer.customer_code
      await admin.from('tenants').update({ paystack_customer_id: customerCode }).eq('id', tenantId)
    } catch (err: any) {
      return NextResponse.json({ error: err.message ?? 'Failed to create customer' }, { status: 502 })
    }
  }

  // 4. Initialize new subscription transaction
  const host    = req.headers.get('host') ?? 'localhost:3000'
  const proto   = host.includes('localhost') ? 'http' : 'https'
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`
  const callbackUrl = `${appUrl}/api/billing/callback`

  try {
    const result = await initializeTransaction({
      email,
      amountPesewas: newPlan.amountPesewas,
      reference:     `switch-${tenantId}-${Date.now()}`,
      callbackUrl,
      channels:      ['card'],
      plan:          newPlan.planCode,
      metadata: {
        source:       'plan_switch',
        tenant_id:    tenantId,
        plan_name:    newPlan.name,
        previous_plan: currentSub?.plan_name ?? 'none',
      },
    })

    return NextResponse.json({
      authorization_url: result.authorizationUrl,
      reference:         result.reference,
      amount_pesewas:    newPlan.amountPesewas,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Paystack error' }, { status: 502 })
  }
}
