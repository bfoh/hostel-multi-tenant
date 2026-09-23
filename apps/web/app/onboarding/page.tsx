import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { provisionTenant } from '@/lib/onboarding/provision-tenant'
import { OnboardingWizard } from '@/components/onboarding/wizard'

export const metadata = { title: 'Set up your hostel — GH Hostels' }

export default async function OnboardingPage() {
  const headersList = await headers()
  const tenantIdHeader = headersList.get('x-tenant-id')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const TENANT_COLS = `id, name, slug, onboarding_completed,
    custom_domain, tagline, contact_phone, contact_email,
    address_city, address_region, currency, timezone,
    primary_color, logo_url`

  type TenantRow = {
    id: string
    name: string
    slug: string
    onboarding_completed: boolean
    custom_domain:  string | null
    tagline:        string | null
    contact_phone:  string | null
    contact_email:  string | null
    address_city:   string | null
    address_region: string | null
    currency:       string | null
    timezone:       string | null
    primary_color:  string | null
    logo_url:       string | null
  }

  // Middleware may already have resolved the tenant onto a header (fast
  // path); otherwise provisionTenant() idempotently finds-or-creates one —
  // single source of truth for tenant bootstrap, see lib/onboarding/provision-tenant.ts.
  const tenantId = tenantIdHeader ?? (await provisionTenant({
    userId: user.id,
    rawName: user.user_metadata?.hostel_name as string | undefined,
  })).tenantId

  const { data } = await admin
    .from('tenants')
    .select(TENANT_COLS)
    .eq('id', tenantId)
    .single()
  const tenantRecord = data as unknown as TenantRow | null

  if (!tenantRecord) {
    return <p className="p-8 text-danger">Could not create your hostel account. Please contact support.</p>
  }

  // Already completed → go to dashboard
  if (tenantRecord.onboarding_completed) redirect('/dashboard')

  return (
    <OnboardingWizard
      tenantId={tenantRecord.id}
      initial={{
        name:           tenantRecord.name,
        slug:           tenantRecord.slug,
        custom_domain:  tenantRecord.custom_domain  ?? '',
        tagline:        tenantRecord.tagline        ?? '',
        contact_phone:  tenantRecord.contact_phone  ?? '',
        contact_email:  tenantRecord.contact_email  ?? user.email ?? '',
        address_city:   tenantRecord.address_city   ?? '',
        address_region: tenantRecord.address_region ?? '',
        currency:       tenantRecord.currency       ?? 'GHS',
        timezone:       tenantRecord.timezone       ?? 'Africa/Accra',
        primary_color:  tenantRecord.primary_color  ?? '#1B4F72',
        logo_url:       tenantRecord.logo_url       ?? '',
      }}
    />
  )
}
