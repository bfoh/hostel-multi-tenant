import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { generateSubscriptionManageLink } from '@/lib/paystack'

/**
 * GET /api/billing/manage-link
 *
 * Returns a Paystack-hosted URL the owner can visit to update the card on
 * their subscription. Link is short-lived — generate on demand.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 400 })

  const admin = createAdminClient()
  const { data: sub } = await admin
    .from('tenant_subscriptions')
    .select('paystack_subscription_code')
    .eq('tenant_id', tenantId)
    .in('status', ['trialing', 'active', 'past_due'])
    .maybeSingle()

  if (!sub?.paystack_subscription_code) {
    return NextResponse.json({ error: 'No active subscription' }, { status: 404 })
  }

  try {
    const { link } = await generateSubscriptionManageLink(sub.paystack_subscription_code)
    return NextResponse.json({ link })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Paystack error' }, { status: 502 })
  }
}
