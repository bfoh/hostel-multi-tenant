import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { listPlatformPlans, findPlanByCode } from '@/lib/platform-plans'
import { listSubscriptions } from '@/lib/paystack'
import { BillingClient } from '@/components/settings/billing-client'

export const metadata: Metadata = { title: 'Billing' }
export const dynamic = 'force-dynamic'

export default async function BillingPage() {
  const tenantId = await getServerTenantId()

  const plans = listPlatformPlans().map((p) => ({
    name:          p.name as 'starter' | 'growth',
    displayName:   p.displayName,
    description:   p.description,
    amountPesewas: p.amountPesewas,
    features:      p.features,
    available:     !!p.planCode,
  }))

  // Fetch tenant plan info
  let tenantPlan = 'starter'
  let tenantStatus = 'trial'
  let trialEndsAt: string | null = null

  let subscription: any = null
  if (tenantId) {
    const admin = createAdminClient()

    const { data: tenantRow } = await admin
      .from('tenants')
      .select('status, plan, trial_ends_at')
      .eq('id', tenantId)
      .single()
    if (tenantRow) {
      tenantPlan = tenantRow.plan ?? 'starter'
      tenantStatus = tenantRow.status ?? 'trial'
      trialEndsAt = tenantRow.trial_ends_at ?? null
    }
    const selectCols = `
      id, plan_name, amount, currency, status,
      current_period_start, current_period_end,
      next_payment_at, last_payment_at, canceled_at
    `

    const { data: first } = await admin
      .from('tenant_subscriptions')
      .select(selectCols)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    subscription = first

    // Auto-heal: if tenant has a Paystack customer but no subscription row,
    // the subscription.create webhook likely never arrived. Reconcile inline
    // so the page renders the current plan on first paint.
    if (!subscription && process.env.PAYSTACK_SECRET_KEY) {
      const { data: tenant } = await admin
        .from('tenants')
        .select('paystack_customer_id')
        .eq('id', tenantId)
        .single()

      if (tenant?.paystack_customer_id) {
        try {
          const subs = await listSubscriptions({ customer: tenant.paystack_customer_id })
          const sorted = [...subs].sort((a, b) => {
            const ad = new Date(a.createdAt ?? a.created_at ?? 0).getTime()
            const bd = new Date(b.createdAt ?? b.created_at ?? 0).getTime()
            return bd - ad
          })
          const sub = sorted.find((s) => s.status === 'active') ?? sorted[0]

          if (sub) {
            const plan = findPlanByCode(sub.plan.plan_code)
            const status = sub.status === 'attention'
              ? 'past_due'
              : sub.status === 'cancelled' || sub.status === 'complete'
                ? 'canceled'
                : 'active'

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

            const { data: refreshed } = await admin
              .from('tenant_subscriptions')
              .select(selectCols)
              .eq('tenant_id', tenantId)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()
            subscription = refreshed
          }
        } catch {
          // Non-fatal: plan grid still renders.
        }
      }
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/settings" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft className="h-4 w-4" /> Settings
        </Link>
        <span className="text-text-disabled">/</span>
        <span className="text-sm font-medium text-text-primary">Billing</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-text-primary">Billing</h1>
        <p className="mt-0.5 text-sm text-text-secondary">
          Your GH Hostels platform subscription. This is separate from the payout account that
          receives guest payments — configure that under Settings → Payouts.
        </p>
      </div>

      <BillingClient
        plans={plans}
        subscription={subscription}
        currentPlan={tenantPlan}
        tenantStatus={tenantStatus}
        trialEndsAt={trialEndsAt}
      />

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
