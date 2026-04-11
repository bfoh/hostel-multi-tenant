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

  // Try to resolve tenant from header first, then DB lookup
  let tenantRecord: { id: string; name: string; slug: string; onboarding_completed: boolean } | null = null

  if (tenantId) {
    const { data } = await admin
      .from('tenants')
      .select('id, name, slug, onboarding_completed')
      .eq('id', tenantId)
      .single()
    tenantRecord = data
  }

  if (!tenantRecord) {
    // Fallback: look up via tenant_members
    const { data: membership } = await admin
      .from('tenant_members')
      .select('tenant_id, tenants(id, name, slug, onboarding_completed)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (membership) {
      const t = Array.isArray(membership.tenants) ? membership.tenants[0] : membership.tenants
      tenantRecord = t as typeof tenantRecord
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
      .select('id, name, slug, onboarding_completed')
      .single()

    if (tenant) {
      await admin.from('tenant_members').insert({
        tenant_id: tenant.id,
        user_id:   user.id,
        role:      'owner',
        is_active: true,
        joined_at: new Date().toISOString(),
      })
      tenantRecord = tenant
    }
  }

  if (!tenantRecord) {
    return <p className="p-8 text-danger">Could not create your hostel account. Please contact support.</p>
  }

  return (
    <OnboardingWizard
      initialName={tenantRecord.name}
      initialSlug={tenantRecord.slug}
      tenantId={tenantRecord.id}
      isNewUser
    />
  )
}
