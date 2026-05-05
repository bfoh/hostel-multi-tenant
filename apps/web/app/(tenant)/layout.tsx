import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { AppHeader } from '@/components/layout/app-header'
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
  if (tenantId && (tenantRole === 'owner' || tenantRole === 'accountant')) {
    const admin = createAdminClient()
    const { count } = await admin
      .from('booking_payments')
      .select('id', { head: true, count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('method', 'bank_draft' as any)
      .eq('status', 'pending')
    initialDraftCount = count ?? 0
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Impersonation banner ─────────────────────────────────── */}
      {isImpersonating && (
        <div className="fixed top-0 inset-x-0 z-50 bg-red-600 text-white text-xs font-medium flex items-center justify-between px-4 py-1.5">
          <span>Super-admin impersonating: <strong>{tenantName}</strong></span>
          <a
            href="/api/admin/impersonate/clear"
            className="underline hover:no-underline"
          >
            Exit impersonation →
          </a>
        </div>
      )}

      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <AppSidebar
        user={user}
        tenantRole={tenantRole}
        tenantId={tenantId}
        initialDraftCount={initialDraftCount}
      />

      {/* ── Main content area ────────────────────────────────────── */}
      <div className={`flex flex-1 flex-col overflow-hidden ${isImpersonating ? 'mt-8' : ''}`}>
        <AppHeader user={user} />
        <TrialBanner />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
