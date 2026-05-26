import { NextResponse } from 'next/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { getServerTenantId } from '@/lib/auth/tenant'

/**
 * GET /api/billing/status — current subscription state for the tenant.
 */
export async function GET() {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const admin = await createTenantAdminClientFromHeaders()
  const { data } = await admin
    .from('tenant_subscriptions')
    .select(`
      id,
      plan_name,
      amount,
      currency,
      status,
      current_period_start,
      current_period_end,
      next_payment_at,
      last_payment_at,
      canceled_at,
      paystack_subscription_code
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ subscription: data ?? null })
}
