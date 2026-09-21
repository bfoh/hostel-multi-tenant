import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { resolveMobileContextForTenant } from '@/lib/auth/mobile-context'
import { StaffMobileBottomNav } from '@/components/staff-mobile/bottom-nav'

export const dynamic = 'force-dynamic'

/**
 * Role gate for the mobile-first staff portal — every tenant_members role
 * except 'owner' (which has its own dedicated mobile home; see
 * app/(tenant)/owner-digest) and 'occupant' (occupant-portal). Mirrors
 * OwnerDigestLayout's gating pattern.
 */
export default async function StaffMobileLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const h        = await headers()
  const tenantId = h.get('x-tenant-id')
  const ctx      = await resolveMobileContextForTenant(user.id, tenantId)

  if (ctx.role === 'owner')    redirect('/owner-digest')
  if (ctx.role === 'occupant') redirect('/occupant-portal')
  if (!ctx.role || !ctx.tenantId) redirect('/login')

  const tenantName  = h.get('x-tenant-name') ?? 'GH Hostels'
  const tenantLogo  = h.get('x-tenant-logo')
  const tenantColor = h.get('x-tenant-color') ?? '#2F7D57'

  return (
    <div className="min-h-screen bg-[#F6F7F9]">
      {/* ── Top header ─────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-30 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_-16px_rgba(0,0,0,0.35)]"
        style={{
          background: `linear-gradient(165deg, ${tenantColor} 0%, ${tenantColor}e6 100%)`,
          paddingTop: 'env(safe-area-inset-top)',
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
              <p className="text-[11px] font-medium capitalize text-white/65">{ctx.role.replace('_', ' ')}</p>
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
        {children}
      </main>

      {/* ── Bottom navigation ─────────────────────────────────── */}
      <StaffMobileBottomNav color={tenantColor} userId={user.id} />
    </div>
  )
}
