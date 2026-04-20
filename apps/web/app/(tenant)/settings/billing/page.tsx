import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { listPlatformPlans } from '@/lib/platform-plans'
import { BillingClient } from '@/components/settings/billing-client'

export const metadata: Metadata = { title: 'Billing' }
export const dynamic = 'force-dynamic'

export default async function BillingPage() {
  const tenantId = await getServerTenantId()

  const plans = listPlatformPlans().map((p) => ({
    name:          p.name,
    displayName:   p.displayName,
    description:   p.description,
    amountPesewas: p.amountPesewas,
    features:      p.features,
    available:     !!p.planCode,
  }))

  let subscription: any = null
  if (tenantId) {
    const admin = createAdminClient()
    const { data } = await admin
      .from('tenant_subscriptions')
      .select(`
        id, plan_name, amount, currency, status,
        current_period_start, current_period_end,
        next_payment_at, last_payment_at, canceled_at
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    subscription = data
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Billing</h1>
        <p className="mt-0.5 text-sm text-text-secondary">
          Your GH Hostels platform subscription. This is separate from the payout account that
          receives guest payments — configure that under Settings → Payouts.
        </p>
      </div>

      <BillingClient plans={plans} subscription={subscription} />

      <div className="rounded-xl border border-border bg-surface-sunken p-5 text-xs text-text-secondary space-y-2">
        <p className="font-medium text-text-primary">Billing notes</p>
        <ul className="space-y-1 list-disc pl-4">
          <li>Subscriptions are billed monthly by card through Paystack.</li>
          <li>Cancelling keeps access until the current period ends.</li>
          <li>Update your card anytime via the Paystack-hosted manage link — we never see your card details.</li>
        </ul>
      </div>
    </div>
  )
}
