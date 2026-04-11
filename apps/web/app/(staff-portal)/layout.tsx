import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StaffBottomNav } from '@/components/staff-portal/bottom-nav'

export default async function StaffPortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const headersList = await headers()
  const tenantName  = headersList.get('x-tenant-name') ?? 'GH Hostels'
  const tenantLogo  = headersList.get('x-tenant-logo')
  const tenantColor = headersList.get('x-tenant-color') ?? '#2563EB'

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Top header ─────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-30 shadow-sm"
        style={{ background: tenantColor }}
      >
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            {tenantLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tenantLogo} alt={tenantName} className="h-7 w-auto max-w-[120px] object-contain" />
            ) : (
              <span className="font-display text-base font-bold text-white">{tenantName}</span>
            )}
            <span className="hidden rounded-full border border-white/20 bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-white/80 sm:block">
              Staff Portal
            </span>
          </div>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="rounded-lg border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* ── Page content ─────────────────────────────────────── */}
      <main className="mx-auto max-w-5xl px-4 py-5 pb-24 sm:px-6">
        {children}
      </main>

      {/* ── Bottom navigation ─────────────────────────────────── */}
      <StaffBottomNav color={tenantColor} />
    </div>
  )
}
