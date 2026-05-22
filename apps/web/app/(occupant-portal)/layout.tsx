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
    .select('tenant_id, tenants(name, primary_color, logo_url, food_orders_enabled)')
    .eq('user_id' as any, user.id)
    .single()

  const tenant      = Array.isArray(occupant?.tenants) ? occupant.tenants[0] : occupant?.tenants
  const tenantName  = tenant?.name         ?? 'Resident Portal'
  const tenantColor = (tenant as any)?.primary_color ?? '#2563EB'
  const tenantLogo  = (tenant as any)?.logo_url      ?? null
  const foodEnabled = !!(tenant as any)?.food_orders_enabled

  return (
    <div className="min-h-screen bg-[#F6F7F9]">
      {/* ── Top header ─────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-30 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_-16px_rgba(0,0,0,0.35)]"
        style={{
          background: `linear-gradient(165deg, ${tenantColor} 0%, ${tenantColor}e6 100%)`,
        }}
      >
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            {tenantLogo ? (
              <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white/95 shadow-sm ring-1 ring-white/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={tenantLogo} alt={tenantName} className="h-8 w-8 object-contain" />
              </span>
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-base font-bold text-white ring-1 ring-white/25">
                {tenantName.charAt(0)}
              </span>
            )}
            <div className="leading-tight">
              <p className="font-display text-[15px] font-bold text-white">{tenantName}</p>
              <p className="text-[11px] font-medium text-white/65">Resident Portal</p>
            </div>
          </div>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="rounded-xl border border-white/20 bg-white/12 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/22 active:scale-95"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* ── Page content ─────────────────────────────────────── */}
      <main className="mx-auto max-w-2xl px-4 pb-28 pt-5 sm:px-6">
        {user.created_at && (
          <ChangePasswordBanner createdAt={user.created_at} />
        )}
        <div className={user.created_at ? 'mt-4' : ''}>
          {children}
        </div>
      </main>

      {/* ── Bottom navigation ─────────────────────────────────── */}
      <BottomNav color={tenantColor} foodEnabled={foodEnabled} />
    </div>
  )
}
