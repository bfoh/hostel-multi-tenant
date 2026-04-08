import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { ProfileForm } from '@/components/settings/profile-form'
import { BrandingForm } from '@/components/settings/branding-form'
import { NotificationsForm } from '@/components/settings/notifications-form'
import { PasswordForm } from '@/components/settings/password-form'

export const metadata: Metadata = { title: 'Settings' }

const TABS = [
  { value: 'profile',       label: 'Profile'       },
  { value: 'branding',      label: 'Branding'      },
  { value: 'notifications', label: 'Notifications' },
  { value: 'security',      label: 'Security'      },
]

async function getTenant() {
  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return null

  const supabase = await createClient()
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

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab = 'profile' } = await searchParams
  const tenant = await getTenant()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
        <p className="mt-0.5 text-sm text-text-secondary">
          Manage your hostel profile, branding, and account preferences.
        </p>
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

                {/* Storage setup notice */}
                <div className="rounded-lg border border-info/20 bg-info-subtle px-4 py-3 text-xs text-info">
                  <strong>Logo upload requires Supabase Storage.</strong> Run this in your Supabase SQL editor to enable it:
                  <pre className="mt-2 overflow-x-auto rounded bg-white/50 p-2 font-mono text-[11px] text-text-primary">
{`insert into storage.buckets (id, name, public)
values ('tenant-logos', 'tenant-logos', true)
on conflict do nothing;

create policy "tenant logo upload"
  on storage.objects for insert
  with check (bucket_id = 'tenant-logos'
    and auth.role() = 'authenticated');

create policy "tenant logo read"
  on storage.objects for select
  using (bucket_id = 'tenant-logos');`}
                  </pre>
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
          </>
        )}
      </div>
    </div>
  )
}
