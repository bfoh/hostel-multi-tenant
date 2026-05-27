import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { initializeTransaction, createCustomer } from '@/lib/paystack'
import { getPlatformPlan, type PlatformPlanName } from '@/lib/platform-plans'

const schema = z.object({
  plan: z.enum(['starter', 'growth']),
})

/**
 * POST /api/billing/subscribe
 *
 * Starts a platform subscription for the current tenant:
 *   1. ensures a Paystack customer exists for the billing email
 *   2. initializes a Paystack transaction with `plan` attached — on successful
 *      first charge, Paystack auto-creates the subscription and we get a
 *      subscription.create webhook
 *   3. returns an authorization_url to redirect the owner to Paystack
 *
 * No `subaccount` — these funds settle to the platform merchant's bank.
 */
export async function POST(req: NextRequest) {
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

  const plan = getPlatformPlan(parsed.data.plan as PlatformPlanName)
  if (!plan) return NextResponse.json({ error: 'Unknown plan' }, { status: 422 })
  if (!plan.planCode) {
    return NextResponse.json(
      { error: `Plan ${plan.name} is not linked to a Paystack plan code. Run the admin bootstrap first.` },
      { status: 503 },
    )
  }

  const admin = await createTenantAdminClientFromHeaders()

  // Block duplicate live subscriptions
  const { data: existing } = await admin
    .from('tenant_subscriptions')
    .select('id, status, paystack_subscription_code')
    .eq('tenant_id', tenantId)
    .in('status', ['trialing', 'active', 'past_due'])
    .maybeSingle()

  if (existing?.paystack_subscription_code) {
    return NextResponse.json(
      { error: 'This hostel already has an active subscription.' },
      { status: 409 },
    )
  }

  // Fetch tenant + billing email
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

  // Ensure Paystack customer
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

  const host    = req.headers.get('host') ?? 'localhost:3000'
  const proto   = host.includes('localhost') ? 'http' : 'https'
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`
  const callbackUrl = `${appUrl}/api/billing/callback`

  try {
    const result = await initializeTransaction({
      email,
      amountPesewas: plan.amountPesewas,
      reference:     `sub-${tenantId}-${Date.now()}`,
      callbackUrl,
      channels:      ['card'],                   // subscriptions: card only (tokenizable)
      plan:          plan.planCode,
      metadata: {
        source:       'platform_subscription',
        tenant_id:    tenantId,
        plan_name:    plan.name,
      },
    })

    return NextResponse.json({
      authorization_url: result.authorizationUrl,
      reference:         result.reference,
      amount_pesewas:    plan.amountPesewas,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Paystack error' }, { status: 502 })
  }
}
