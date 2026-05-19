import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { DigestSettingsForm } from '@/components/settings/digest-settings-form'

export const metadata: Metadata = { title: 'Daily digest' }
export const dynamic = 'force-dynamic'

export default async function DigestSettingsPage() {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) redirect('/login')

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('tenants')
    .select('name, timezone, contact_phone, contact_email, daily_digest_enabled, daily_digest_time, daily_digest_channels, daily_digest_recipients, daily_digest_paused_until')
    .eq('id', tenantId)
    .single()
  const t = data as any

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-text-primary">Daily digest</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Owners get a one-screen summary of every revenue stream, occupancy,
          cash variance, and open issues. Sent automatically each evening.
        </p>
      </header>

      <DigestSettingsForm
        initial={{
          enabled:       t?.daily_digest_enabled ?? true,
          time:          t?.daily_digest_time ?? '19:00',
          channels:      t?.daily_digest_channels ?? { sms: true, email: true, push: true },
          recipients:    t?.daily_digest_recipients ?? [],
          pausedUntil:   t?.daily_digest_paused_until ?? null,
        }}
        primary={{
          phone: t?.contact_phone ?? null,
          email: t?.contact_email ?? null,
        }}
        timezone={t?.timezone ?? 'Africa/Accra'}
      />
    </div>
  )
}
