import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { BottomNav } from '@/components/occupant-portal/bottom-nav'
import { ChangePasswordBanner } from '@/components/occupant-portal/change-password-banner'

export default async function OccupantPortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch tenant branding directly from the DB using the occupant's user_id.
  // This is authoritative and works regardless of JWT claim freshness or
  // subdomain resolution — critical for localhost dev and first-login flows.
  const admin = createAdminClient()
  const { data: occupant } = await admin
    .from('occupants')
    .select('tenant_id, tenants(name, primary_color, logo_url)')
    .eq('user_id' as any, user.id)
    .single()

  const tenant     = Array.isArray(occupant?.tenants) ? occupant.tenants[0] : occupant?.tenants
  const tenantName  = tenant?.name         ?? 'Resident Portal'
  const tenantColor = tenant?.primary_color ?? '#2563EB'
  const tenantLogo  = tenant?.logo_url      ?? null

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Top header ─────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-30"
        style={{ background: tenantColor }}
      >
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            {tenantLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tenantLogo} alt={tenantName} className="h-7 w-auto max-w-[120px] object-contain" />
            ) : (
              <span className="font-display text-base font-bold text-white">{tenantName}</span>
            )}
            <span className="hidden rounded-full border border-white/20 bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-white/80 sm:block">
              Resident Portal
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
      <main className="mx-auto max-w-2xl px-4 py-5 pb-24 sm:px-6">
        {user.created_at && (
          <ChangePasswordBanner createdAt={user.created_at} />
        )}
        <div className={user.created_at ? 'mt-4' : ''}>
          {children}
        </div>
      </main>

      {/* ── Bottom navigation ─────────────────────────────────── */}
      <BottomNav color={tenantColor} />
    </div>
  )
}
