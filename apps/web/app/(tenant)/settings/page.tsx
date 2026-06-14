import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { ProfileForm } from '@/components/settings/profile-form'
import { BrandingForm } from '@/components/settings/branding-form'
import { DigestSettingsForm } from '@/components/settings/digest-settings-form'
import { BankDepositForm } from '@/components/settings/bank-deposit-form'
import { NotificationsForm } from '@/components/settings/notifications-form'
import { PasswordForm } from '@/components/settings/password-form'
import { PushToggle } from '@/components/settings/push-toggle'
import { BillingClient } from '@/components/settings/billing-client'
import {
  listPlatformPlans, listAllPlanVariants, findPlanByCode, BILLING_INTERVALS,
} from '@/lib/platform-plans'
import { listSubscriptions } from '@/lib/paystack'
import { Globe, Bot, Link2, CalendarRange, Webhook, MessageSquare, Landmark, Receipt, QrCode, ChevronRight, AlertTriangle, CheckCircle2, Inbox } from 'lucide-react'

export const metadata: Metadata = { title: 'Settings' }
export const dynamic = 'force-dynamic'

const TABS = [
  { value: 'profile',       label: 'Profile'       },
  { value: 'branding',      label: 'Branding'      },
  { value: 'notifications', label: 'Notifications' },
  { value: 'digest',        label: 'Digest'        },
  { value: 'security',      label: 'Security'      },
  { value: 'billing',       label: 'Billing'       },
]

async function getTenant() {
  const tenantId = await getServerTenantId()
  if (!tenantId) return null

  const supabase = createAdminClient()
  const { data } = await (supabase
    .from('tenants') as any)
    .select(`
      id, name, slug, custom_domain,
      tagline, contact_phone, contact_email,
      address_line1, address_city, address_region, website_url,
      primary_color, accent_color, logo_url,
      currency, timezone,
      sms_enabled, email_enabled, momo_enabled,
      inter_occupant_dm_enabled, roommate_matching_enabled,
      status, plan, trial_ends_at,
      bank_name, bank_branch, bank_account_name, bank_account_number,
      bank_swift_code, bank_instructions, bank_deposits_enabled,
      paystack_subaccount_code,
      daily_digest_enabled, daily_digest_time, daily_digest_channels,
      daily_digest_recipients, daily_digest_paused_until
    `)
    .eq('id', tenantId)
    .single()

  return data as any
}

async function getBillingData(tenantId: string) {
  const plans = listPlatformPlans().map((p) => ({
    name:               p.name as 'starter' | 'growth',
    displayName:        p.displayName,
    description:        p.description,
    baseMonthlyPesewas: p.baseMonthlyPesewas,
    features:           p.features,
  }))

  const intervals = BILLING_INTERVALS.map((iv) => ({
    id:              iv.id,
    label:           iv.label,
    months:          iv.months,
    discountPercent: Math.round(iv.discount * 100),
  }))

  const pricing: Record<string, Record<string, {
    amountPesewas: number; monthlyPesewas: number; discountPercent: number; available: boolean
  }>> = {}
  for (const v of listAllPlanVariants()) {
    pricing[v.name] ??= {}
    pricing[v.name][v.interval] = {
      amountPesewas:   v.amountPesewas,
      monthlyPesewas:  v.monthlyPesewas,
      discountPercent: v.discountPercent,
      available:       !!v.planCode,
    }
  }

  let subscription: any = null
  const admin = createAdminClient()
  const selectCols = `
    id, plan_name, billing_interval, amount, currency, status,
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
                billing_interval:           plan?.interval ?? 'monthly',
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

  return { plans, pricing, intervals, subscription }
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

  // Bank deposit details are owner-only. Read the role from the
  // x-tenant-role request header injected by middleware (the standard pattern
  // used everywhere else in (tenant)/).
  const callerRole = (await headers()).get('x-tenant-role')
  const canEditBank = callerRole === 'owner'

  // Derive effective plan label for display
  const effectivePlan = tenant?.status === 'trial'
    ? 'trial'
    : tenant?.plan ?? 'starter'

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

      {/* Payouts CTA — surfaces the /settings/payouts page (it is not a tab
          because subaccount setup is a multi-step flow on its own route).
          Style turns warning when no subaccount is connected so guest
          payments fall back to "pay at front desk" until fixed. */}
      <Link
        href="/settings/payouts"
        className={`flex items-center gap-3 rounded-xl border p-4 transition-colors ${
          tenant?.paystack_subaccount_code
            ? 'border-border bg-surface hover:bg-surface-raised'
            : 'border-warning/30 bg-warning-subtle hover:bg-warning-subtle/80'
        }`}
      >
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${
            tenant?.paystack_subaccount_code ? 'bg-success-subtle text-success' : 'bg-warning text-warning-fg'
          }`}
        >
          {tenant?.paystack_subaccount_code ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <AlertTriangle className="h-5 w-5" />
          )}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-text-primary">Payouts</p>
          <p className="text-xs text-text-secondary">
            {tenant?.paystack_subaccount_code
              ? 'Bank account connected. Online payments settle to your account.'
              : 'Connect your bank account to accept online payments and enable Paystack checkout.'}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 text-text-tertiary" />
      </Link>

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

                {(tenant as any).paystack_subaccount_code && !(tenant as any).bank_name && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
                    Add bank deposit details to give residents a second way to pay.
                  </div>
                )}

                <BankDepositForm
                  tenantId={tenant.id}
                  initial={{
                    bank_name:             (tenant as any).bank_name             ?? null,
                    bank_branch:           (tenant as any).bank_branch           ?? null,
                    bank_account_name:     (tenant as any).bank_account_name     ?? null,
                    bank_account_number:   (tenant as any).bank_account_number   ?? null,
                    bank_swift_code:       (tenant as any).bank_swift_code       ?? null,
                    bank_instructions:     (tenant as any).bank_instructions     ?? null,
                    bank_deposits_enabled: (tenant as any).bank_deposits_enabled ?? false,
                  }}
                  canEdit={canEditBank}
                />
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
              </section>
            )}

            {tab === 'digest' && (
              <section className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-text-primary">Daily digest</h2>
                  <p className="mt-0.5 text-sm text-text-secondary">
                    Owners get a one-screen summary of every revenue stream, occupancy,
                    cash variance, and open issues — sent automatically each evening.
                  </p>
                </div>
                <DigestSettingsForm
                  initial={{
                    enabled:     (tenant as any).daily_digest_enabled ?? true,
                    time:        (tenant as any).daily_digest_time ?? '19:00',
                    channels:    (tenant as any).daily_digest_channels ?? { sms: true, email: true, push: true },
                    recipients:  (tenant as any).daily_digest_recipients ?? [],
                    pausedUntil: (tenant as any).daily_digest_paused_until ?? null,
                  }}
                  primary={{
                    phone: (tenant as any).contact_phone ?? null,
                    email: (tenant as any).contact_email ?? null,
                  }}
                  timezone={(tenant as any).timezone ?? 'Africa/Accra'}
                />
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
                    href="/settings/enquiry-webhook"
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm hover:bg-surface transition-colors"
                  >
                    <Inbox className="h-4 w-4 text-brand shrink-0" />
                    <div>
                      <p className="font-medium text-text-primary">Website Enquiry Webhook</p>
                      <p className="text-xs text-text-secondary">Receive enquiries from Readdy, FormBold, Zapier or any external form into the dashboard</p>
                    </div>
                  </Link>
                  <Link
                    href="/settings/webhooks"
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm hover:bg-surface transition-colors"
                  >
                    <Webhook className="h-4 w-4 text-brand shrink-0" />
                    <div>
                      <p className="font-medium text-text-primary">Outbound Webhooks</p>
                      <p className="text-xs text-text-secondary">Send real-time HTTP events from this hostel to external systems</p>
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
                    href="/settings/self-checkin"
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm hover:bg-surface transition-colors"
                  >
                    <QrCode className="h-4 w-4 text-brand shrink-0" />
                    <div>
                      <p className="font-medium text-text-primary">Self Check-in QR</p>
                      <p className="text-xs text-text-secondary">Print a QR code so guests can self check-in at the front desk</p>
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
                      <p className="mt-0.5 font-medium capitalize text-text-primary">{effectivePlan}</p>
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
                    <BillingClient
                      plans={billingData.plans}
                      pricing={billingData.pricing}
                      intervals={billingData.intervals}
                      subscription={billingData.subscription}
                      currentPlan={tenant?.plan ?? 'starter'}
                      tenantStatus={tenant?.status ?? 'trial'}
                      trialEndsAt={tenant?.trial_ends_at ?? null}
                    />

                    <div className="rounded-xl border border-border bg-surface-sunken p-5 text-xs text-text-secondary space-y-2">
                      <p className="font-medium text-text-primary">Billing notes</p>
                      <ul className="space-y-1 list-disc pl-4">
                        <li>Subscriptions are billed by card through Paystack on your chosen cycle — monthly, quarterly, every 6 months, or yearly. Longer cycles are discounted up to 15%.</li>
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
