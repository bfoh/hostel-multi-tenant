import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { disableSubscription } from '@/lib/paystack'

/**
 * POST /api/billing/cancel — disables the active subscription on Paystack.
 * The subscription stays `active` until the current period ends; Paystack
 * fires subscription.disable/not_renew, which the webhook handles.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 400 })

  const admin = await createTenantAdminClientFromHeaders()

  const { data: sub } = await admin
    .from('tenant_subscriptions')
    .select('id, paystack_subscription_code, paystack_email_token, status')
    .eq('tenant_id', tenantId)
    .in('status', ['trialing', 'active', 'past_due'])
    .maybeSingle()

  if (!sub?.paystack_subscription_code || !sub.paystack_email_token) {
    return NextResponse.json({ error: 'No active subscription to cancel' }, { status: 404 })
  }

  try {
    await disableSubscription({
      code:  sub.paystack_subscription_code,
      token: sub.paystack_email_token,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Paystack error' }, { status: 502 })
  }

  // Reflect immediately locally — webhook confirmation follows
  await admin
    .from('tenant_subscriptions')
    .update({ status: 'canceled', canceled_at: new Date().toISOString() })
    .eq('id', sub.id)

  return NextResponse.json({ ok: true })
}
