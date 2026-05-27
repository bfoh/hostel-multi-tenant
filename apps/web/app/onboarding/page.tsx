import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { OnboardingWizard } from '@/components/onboarding/wizard'

export const metadata = { title: 'Set up your hostel — GH Hostels' }

export default async function OnboardingPage() {
  const headersList = await headers()
  const tenantId    = headersList.get('x-tenant-id')

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

  let tenantRecord: TenantRow | null = null

  if (tenantId) {
    const { data } = await admin
      .from('tenants')
      .select(TENANT_COLS)
      .eq('id', tenantId)
      .single()
    tenantRecord = data as unknown as TenantRow | null
  }

  if (!tenantRecord) {
    const { data: membership } = await admin
      .from('tenant_members')
      .select(`tenant_id, tenants(${TENANT_COLS})`)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (membership) {
      const t = Array.isArray(membership.tenants) ? membership.tenants[0] : membership.tenants
      tenantRecord = t as unknown as TenantRow
    }
  }

  // Already completed → go to dashboard
  if (tenantRecord?.onboarding_completed) redirect('/dashboard')

  // No tenant at all — provision one inline and show wizard
  if (!tenantRecord) {
    const rawName: string = (user.user_metadata?.hostel_name as string) ?? ''
    const hostelName = rawName.trim() || 'My Hostel'
    const baseSlug = hostelName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'hostel'

    let slug = baseSlug
    let attempt = 0
    while (true) {
      const { data: taken } = await admin.from('tenants').select('id').eq('slug', slug).maybeSingle()
      if (!taken) break
      attempt++
      slug = `${baseSlug}-${attempt}`
    }

    const { data: tenant } = await admin
      .from('tenants')
      .insert({ name: hostelName, slug, status: 'trial', onboarding_completed: false })
      .select(TENANT_COLS)
      .single()

    if (tenant) {
      await admin.from('tenant_members').insert({
        tenant_id: tenant.id,
        user_id:   user.id,
        role:      'owner',
        is_active: true,
        joined_at: new Date().toISOString(),
      })
      tenantRecord = tenant as unknown as TenantRow
    }
  }

  if (!tenantRecord) {
    return <p className="p-8 text-danger">Could not create your hostel account. Please contact support.</p>
  }

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
