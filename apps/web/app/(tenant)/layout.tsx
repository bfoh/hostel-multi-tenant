import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppShell } from '@/components/layout/app-shell'
import { TrialBanner } from '@/components/layout/trial-banner'

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const headersList = await headers()
  const isImpersonating = headersList.get('x-admin-impersonating') === 'true'
  const tenantName  = headersList.get('x-tenant-name') ?? ''
  const tenantRole  = headersList.get('x-tenant-role') ?? headersList.get('x-portal-role') ?? 'staff'
  const tenantId    = headersList.get('x-tenant-id') ?? ''

  // Initial pending bank-draft count for the sidebar badge — only fetched
  // for owner/accountant since the link is hidden from other roles anyway.
  let initialDraftCount = 0
  let initialEnquiryCount = 0
  if (tenantId) {
    const admin = createAdminClient()
    if (tenantRole === 'owner' || tenantRole === 'accountant') {
      const { count } = await admin
        .from('booking_payments')
        .select('id', { head: true, count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('method', 'bank_draft' as any)
        .eq('status', 'pending')
      initialDraftCount = count ?? 0
    }
    if (tenantRole === 'owner' || tenantRole === 'manager') {
      const { count } = await (admin
        .from('waiting_list') as any)
        .select('id', { head: true, count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('source', 'website')
        .eq('status', 'waiting')
      initialEnquiryCount = count ?? 0
    }
  }

  return (
    <AppShell
      user={user}
      tenantRole={tenantRole}
      tenantId={tenantId}
      initialDraftCount={initialDraftCount}
      initialEnquiryCount={initialEnquiryCount}
      isImpersonating={isImpersonating}
      trialBanner={<TrialBanner />}
    >
      {children}
    </AppShell>
  )
}
