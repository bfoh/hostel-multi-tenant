import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { SelfCheckinQR } from '@/components/settings/self-checkin-qr'

export const metadata: Metadata = { title: 'Self Check-in QR' }

export default async function SelfCheckinSettingsPage() {
  const tenantId = await getServerTenantId()
  if (!tenantId) redirect('/login')

  const admin = createAdminClient()
  const { data: tenant } = await admin
    .from('tenants')
    .select('slug, name, logo_url, primary_color, contact_phone')
    .eq('id', tenantId)
    .single()

  if (!tenant) redirect('/dashboard')

  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const proto = host.includes('localhost') ? 'http' : 'https'
  const checkinUrl = `${proto}://${host}/checkin/${tenant.slug}`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Self Check-in QR</h1>
        <p className="mt-0.5 text-sm text-text-secondary">
          Print this QR code at the front desk. Guests scan, fill their details, capture their Ghana Card, and pay online. Staff confirm bookings in the dashboard.
        </p>
      </div>

      <SelfCheckinQR
        checkinUrl={checkinUrl}
        hostelName={tenant.name}
        logoUrl={tenant.logo_url}
        primaryColor={tenant.primary_color}
        contactPhone={tenant.contact_phone}
      />
    </div>
  )
}
