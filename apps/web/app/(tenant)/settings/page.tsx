import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { ProfileForm } from '@/components/settings/profile-form'
import { BrandingForm } from '@/components/settings/branding-form'
import { NotificationsForm } from '@/components/settings/notifications-form'
import { PasswordForm } from '@/components/settings/password-form'
import { PushToggle } from '@/components/settings/push-toggle'
import { BillingClient } from '@/components/settings/billing-client'
import { listPlatformPlans, findPlanByCode } from '@/lib/platform-plans'
import { listSubscriptions } from '@/lib/paystack'
import { Globe, Bot, Link2, CalendarRange, Webhook, MessageSquare, Landmark, Receipt } from 'lucide-react'

export const metadata: Metadata = { title: 'Settings' }
export const dynamic = 'force-dynamic'

const TABS = [
  { value: 'profile',       label: 'Profile'       },
  { value: 'branding',      label: 'Branding'      },
  { value: 'notifications', label: 'Notifications' },
  { value: 'security',      label: 'Security'      },
  { value: 'billing',       label: 'Billing'       },
]

async function getTenant() {
  const tenantId = await getServerTenantId()
  if (!tenantId) return null

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('tenants')
    .select(`
      id, name, slug, custom_domain,
      tagline, contact_phone, contact_email,
      address_line1, address_city, address_region, website_url,
      primary_color, accent_color, logo_url,
      currency, timezone,
      sms_enabled, email_enabled, momo_enabled
    `)
    .eq('id', tenantId)
    .single()

  return data
}

async function getBillingData(tenantId: string) {
  const plans = listPlatformPlans().map((p) => ({
    name:          p.name as 'starter' | 'growth' | 'pro',
    displayName:   p.displayName,
    description:   p.description,
    amountPesewas: p.amountPesewas,
    features:      p.features,
    available:     !!p.planCode,
  }))

  let subscription: any = null
  const admin = createAdminClient()
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

  // Auto-heal: reconcile from Paystack if no local subscription row
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

  return { plans, subscription }
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab = 'profile' } = await searchParams
  const tenant = await getTenant()

  // Fetch billing data only when the billing tab is active
  const tenantId = await getServerTenantId()
  const billingData = tab === 'billing' && tenantId ? await getBillingData(tenantId) : null

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            Manage your hostel profile, branding, and account preferences.
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl border border-border bg-surface-sunken p-1">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={`/settings?tab=${t.value}`}
            className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors ${
              tab === t.value
                ? 'bg-surface shadow-sm text-text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Tab content */}
      <div className="rounded-xl border border-border bg-surface p-6">
        {!tenant ? (
          <p className="text-sm text-danger">Could not load tenant configuration.</p>
        ) : (
          <>
            {tab === 'profile' && (
              <section className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-text-primary">Hostel Profile</h2>
                  <p className="mt-0.5 text-sm text-text-secondary">
                    This information appears on invoices, receipts, and your public booking page.
                  </p>
                </div>
                <ProfileForm tenant={tenant} />
              </section>
            )}

            {tab === 'branding' && (
              <section className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-text-primary">Branding</h2>
                  <p className="mt-0.5 text-sm text-text-secondary">
                    Logo and colours applied to invoices and your booking page.
                  </p>
                </div>

                <BrandingForm tenant={tenant} />
              </section>
            )}

            {tab === 'notifications' && (
              <section className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-text-primary">Notifications & Channels</h2>
                  <p className="mt-0.5 text-sm text-text-secondary">
                    Control which communication and payment channels are active for your hostel.
                  </p>
                </div>
                <NotificationsForm tenant={tenant} />
                <PushToggle />

                {/* API key hints */}
                <div className="mt-4 rounded-lg border border-border bg-surface-sunken p-4 text-xs text-text-secondary space-y-1">
                  <p className="font-medium text-text-primary">Required environment variables</p>
                  <p><code className="font-mono">ARKESEL_API_KEY</code> — for SMS (get from arkesel.com)</p>
                  <p><code className="font-mono">NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY</code> + <code className="font-mono">PAYSTACK_SECRET_KEY</code> — for MoMo payments (paystack.com)</p>
                </div>
              </section>
            )}

            {tab === 'security' && (
              <section className="space-y-6">
                <div>
                  <h2 className="text-base font-semibold text-text-primary">Account Security</h2>
                  <p className="mt-0.5 text-sm text-text-secondary">
                    Change your login password.
                  </p>
                </div>
                <PasswordForm />

                {/* Website CMS shortcut */}
                <div className="border-t border-border pt-6 space-y-2">
                  <Link
                    href="/settings/website"
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm hover:bg-surface transition-colors"
                  >
                    <Globe className="h-4 w-4 text-brand shrink-0" />
                    <div>
                      <p className="font-medium text-text-primary">Website Content</p>
                      <p className="text-xs text-text-secondary">Edit hero, about, gallery and FAQ on your public booking page</p>
                    </div>
                  </Link>
                  <Link
                    href="/settings/ai"
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm hover:bg-surface transition-colors"
                  >
                    <Bot className="h-4 w-4 text-brand shrink-0" />
                    <div>
                      <p className="font-medium text-text-primary">AI Agent</p>
                      <p className="text-xs text-text-secondary">Configure agent name, personality, language and capabilities</p>
                    </div>
                  </Link>
                  <Link
                    href="/settings/domain"
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm hover:bg-surface transition-colors"
                  >
                    <Link2 className="h-4 w-4 text-brand shrink-0" />
                    <div>
                      <p className="font-medium text-text-primary">Custom Domain</p>
                      <p className="text-xs text-text-secondary">
                        {tenant.custom_domain
                          ? <span className="font-mono text-success">{tenant.custom_domain}</span>
                          : 'Connect your own domain to the booking page'}
                      </p>
                    </div>
                  </Link>
                  <Link
                    href="/settings/rates"
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm hover:bg-surface transition-colors"
                  >
                    <CalendarRange className="h-4 w-4 text-brand shrink-0" />
                    <div>
                      <p className="font-medium text-text-primary">Rate Management</p>
                      <p className="text-xs text-text-secondary">Seasonal pricing, promotions, and date-range rate overrides</p>
                    </div>
                  </Link>
                  <Link
                    href="/settings/webhooks"
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm hover:bg-surface transition-colors"
                  >
                    <Webhook className="h-4 w-4 text-brand shrink-0" />
                    <div>
                      <p className="font-medium text-text-primary">Webhooks</p>
                      <p className="text-xs text-text-secondary">Send real-time HTTP events to external systems</p>
                    </div>
                  </Link>
                  <Link
                    href="/settings/notification-templates"
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm hover:bg-surface transition-colors"
                  >
                    <MessageSquare className="h-4 w-4 text-brand shrink-0" />
                    <div>
                      <p className="font-medium text-text-primary">Notification Templates</p>
                      <p className="text-xs text-text-secondary">Customise SMS and email messages sent to occupants</p>
                    </div>
                  </Link>
                  <Link
                    href="/settings/payouts"
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm hover:bg-surface transition-colors"
                  >
                    <Landmark className="h-4 w-4 text-brand shrink-0" />
                    <div>
                      <p className="font-medium text-text-primary">Payouts</p>
                      <p className="text-xs text-text-secondary">Connect the bank account that receives guest payments</p>
                    </div>
                  </Link>
                </div>

                {/* Account info */}
                <div className="border-t border-border pt-6 space-y-3">
                  <h3 className="text-sm font-semibold text-text-primary">Plan & Account</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg border border-border bg-surface-sunken p-3">
                      <p className="text-xs text-text-tertiary">Hostel slug</p>
                      <p className="mt-0.5 font-mono font-medium text-text-primary">{tenant.slug}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-surface-sunken p-3">
                      <p className="text-xs text-text-tertiary">Currency</p>
                      <p className="mt-0.5 font-medium text-text-primary">{tenant.currency}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-surface-sunken p-3">
                      <p className="text-xs text-text-tertiary">Timezone</p>
                      <p className="mt-0.5 font-medium text-text-primary">{tenant.timezone}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-surface-sunken p-3">
                      <p className="text-xs text-text-tertiary">Plan</p>
                      <p className="mt-0.5 font-medium capitalize text-text-primary">Starter</p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {tab === 'billing' && (
              <section className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-text-primary">Billing</h2>
                  <p className="mt-0.5 text-sm text-text-secondary">
                    Your GH Hostels platform subscription. This is separate from the payout account that
                    receives guest payments — configure that under Settings → Payouts.
                  </p>
                </div>

                {billingData ? (
                  <>
                    <BillingClient plans={billingData.plans} subscription={billingData.subscription} />

                    <div className="rounded-xl border border-border bg-surface-sunken p-5 text-xs text-text-secondary space-y-2">
                      <p className="font-medium text-text-primary">Billing notes</p>
                      <ul className="space-y-1 list-disc pl-4">
                        <li>Subscriptions are billed monthly by card through Paystack.</li>
                        <li>Cancelling keeps access until the current period ends.</li>
                        <li>Update your card anytime via the Paystack-hosted manage link — we never see your card details.</li>
                      </ul>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-text-secondary">Loading billing information…</p>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
