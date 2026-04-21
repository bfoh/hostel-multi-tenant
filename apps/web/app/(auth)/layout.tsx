import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Sign in — GH Hostels' }

const FROST = 'rgba(214,235,253,0.19)'

/**
 * Resend-inspired auth layout.
 * Full-screen dark void with a centered card.
 * Tenant-branded variant: brand color accent light + logo.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const headersList  = await headers()
  const tenantName   = headersList.get('x-tenant-name')
  const tenantLogo   = headersList.get('x-tenant-logo')
  const tenantColor  = headersList.get('x-tenant-color') ?? '#3b9eff'
  const isTenantPage = !!tenantName

  const brandColor = isTenantPage ? tenantColor : '#3b9eff'

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center bg-black px-4 py-12 selection:bg-white/20">

      {/* ── Ambient glow background ───────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Top-left sweep */}
        <div
          className="absolute -left-24 -top-24 h-[500px] w-[500px] rounded-full opacity-[0.06] blur-[120px]"
          style={{ background: brandColor }}
        />
        {/* Bottom-right sweep */}
        <div
          className="absolute -bottom-32 -right-32 h-[600px] w-[600px] rounded-full opacity-[0.04] blur-[140px]"
          style={{ background: isTenantPage ? brandColor : '#ff801f' }}
        />
        {/* Center subtle */}
        <div
          className="absolute left-1/2 top-1/2 h-[300px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.03] blur-[100px]"
          style={{ background: brandColor }}
        />
      </div>

      {/* ── Back link ─────────────────────────────────────────────── */}
      <div className="absolute left-6 top-6">
        <Link
          href={isTenantPage ? '/' : 'https://gh-hostels.com'}
          className="flex items-center gap-1.5 text-[13px] font-medium text-[#464a4d] transition-colors hover:text-white"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 12L6 8l4-4" />
          </svg>
          Home
        </Link>
      </div>

      {/* ── Auth card ─────────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-[420px]">

        {/* Logo / Identity */}
        <div className="mb-8 flex flex-col items-center">
          {isTenantPage && tenantLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenantLogo}
              alt={tenantName}
              className="mb-4 h-11 w-auto max-w-[160px] object-contain"
            />
          ) : isTenantPage ? (
            <div className="mb-4 flex items-center gap-2.5">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}cc)` }}
              >
                <span className="text-[16px] font-bold text-white">
                  {tenantName.substring(0, 1).toUpperCase()}
                </span>
              </div>
              <span className="text-[16px] font-semibold text-white tracking-tight">{tenantName}</span>
            </div>
          ) : (
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                  <path d="M3 11L12 3l9 8" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <rect x="7" y="13" width="3.5" height="3.5" rx="0.5" fill="black"/>
                  <rect x="13.5" y="13" width="3.5" height="3.5" rx="0.5" fill="black"/>
                </svg>
              </div>
              <span className="text-[16px] font-semibold text-white tracking-tight">GH Hostels</span>
            </div>
          )}
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            border: `1px solid ${FROST}`,
            background: 'rgba(255,255,255,0.02)',
            boxShadow: `0 0 80px -20px ${brandColor}10`,
          }}
        >
          {children}
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-[11px] text-[#464a4d]">
          {isTenantPage
            ? `© ${new Date().getFullYear()} ${tenantName}. Powered by GH Hostels.`
            : `© ${new Date().getFullYear()} GH Hostels. All rights reserved.`}
        </p>
      </div>
    </div>
  )
}
