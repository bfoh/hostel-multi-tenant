import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'

import { BeddiloWordmark } from '@/components/brand/beddilo-logo'

export const metadata: Metadata = { title: 'Sign in' }

const TEAL_SOFT = '#2A5A61'
const AMBER = '#F2B95A'

/**
 * Auth layout — Beddilo deep-teal canvas with ivory type and amber accents.
 * Tenant-branded variant: the tenant's own logo/name, and their brand color
 * for the ambient glow, on top of the same dark canvas.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const headersList  = await headers()
  const tenantName   = headersList.get('x-tenant-name')
  const tenantLogo   = headersList.get('x-tenant-logo')
  const tenantColor  = headersList.get('x-tenant-color')
  const isTenantPage = !!tenantName

  const accentA = isTenantPage && tenantColor ? tenantColor : TEAL_SOFT
  const accentB = isTenantPage && tenantColor ? tenantColor : AMBER

  return (
    <div
      className="relative flex min-h-[100dvh] items-center justify-center overflow-x-hidden bg-bd-teal-950 px-4 text-bd-ivory selection:bg-bd-amber/40"
      style={{
        // max() so this still gives the original 3rem breathing room on a
        // regular browser (env() resolves to 0 there) while clearing the
        // notch/status bar and home indicator inside the native app, where
        // viewport-fit=cover (see app/layout.tsx) makes env() non-zero.
        paddingTop: 'max(4rem, calc(env(safe-area-inset-top) + 3rem))',
        paddingBottom: 'max(3rem, calc(env(safe-area-inset-bottom) + 1rem))',
      }}
    >
      {/* ── Ambient background ────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute -left-32 -top-32 h-[560px] w-[560px] rounded-full opacity-[0.45] blur-[140px]"
          style={{ background: accentA }}
        />
        <div
          className="absolute -bottom-40 -right-40 h-[640px] w-[640px] rounded-full opacity-[0.14] blur-[160px]"
          style={{ background: accentB }}
        />
      </div>

      {/* ── Back link ─────────────────────────────────────────────── */}
      <div
        className="absolute left-4 z-20 sm:left-6"
        style={{ top: 'max(1.25rem, calc(env(safe-area-inset-top) + 0.75rem))' }}
      >
        <Link
          href="/"
          className="bd-focus-on-dark flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[13px] font-medium text-bd-ivory/75 transition-colors hover:text-bd-ivory"
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M10 12L6 8l4-4" />
          </svg>
          Home
        </Link>
      </div>

      {/* ── Auth card ─────────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-[440px]">
        {/* Logo / Identity */}
        <div className="mb-7 flex flex-col items-center">
          {isTenantPage && tenantLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenantLogo}
              alt={tenantName}
              className="h-11 w-auto max-w-[160px] object-contain"
            />
          ) : isTenantPage ? (
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: `linear-gradient(135deg, ${accentA}, ${accentB})` }}
              >
                <span className="text-[16px] font-bold text-white">
                  {tenantName.substring(0, 1).toUpperCase()}
                </span>
              </div>
              <span className="font-display text-[16px] font-bold text-bd-ivory">{tenantName}</span>
            </div>
          ) : (
            <Link href="/" aria-label="Beddilo home" className="bd-focus-on-dark rounded-lg p-1 text-bd-ivory">
              <BeddiloWordmark className="h-9 w-auto" title="" />
            </Link>
          )}
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-bd-ivory/15 bg-bd-teal/70 p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] backdrop-blur-sm sm:p-8">
          {children}
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-[12px] text-bd-ivory/60">
          {isTenantPage
            ? `© ${new Date().getFullYear()} ${tenantName} · Powered by Beddilo`
            : `© ${new Date().getFullYear()} Beddilo · A world of stays`}
        </p>
      </div>
    </div>
  )
}
