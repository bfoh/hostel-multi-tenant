import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

import { createClient } from '@/lib/supabase/server'
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
      <AppSidebar user={user} tenantRole={tenantRole} />

      {/* ── Main content area ────────────────────────────────────── */}
      <div className={`flex flex-1 flex-col overflow-hidden ${isImpersonating ? 'mt-8' : ''}`}>
        <AppHeader user={user} />
        <TrialBanner />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
