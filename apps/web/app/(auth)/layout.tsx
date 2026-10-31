import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'

import { BeddiloWordmark } from '@/components/brand/beddilo-logo'

export const metadata: Metadata = { title: 'Sign in' }

const TEAL = '#173B42'

/**
 * Auth layout — a white card on the marketplace's mist page, the same look
 * as the public site. Tenant-branded variant: the tenant's own logo, or
 * their name with an initial tile in their brand colour, above the same card.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const headersList  = await headers()
  const tenantName   = headersList.get('x-tenant-name')
  const tenantLogo   = headersList.get('x-tenant-logo')
  const tenantColor  = headersList.get('x-tenant-color')
  const isTenantPage = !!tenantName

  return (
    <div
      className="flex min-h-[100dvh] flex-col bg-bd-mist text-bd-ink selection:bg-bd-teal/20"
      style={{
        // Clears the notch/status bar and home indicator inside the native
        // app, where viewport-fit=cover (see app/layout.tsx) makes env()
        // non-zero; resolves to 0 in a regular browser.
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* ── Back link ─────────────────────────────────────────────── */}
      <div className="flex h-14 items-center px-3 sm:h-16 sm:px-5">
        <Link
          href="/"
          className="bd-focus flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 text-[14px] font-medium text-bd-slate transition-colors hover:text-bd-ink"
        >
          <svg
            className="h-4 w-4"
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
      <div className="flex flex-1 justify-center px-4 pb-12 pt-2 sm:items-center sm:pb-16 sm:pt-0">
        <div className="w-full max-w-[440px]">
          {/* Logo / Identity */}
          <div className="mb-6 flex flex-col items-center sm:mb-8">
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
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ background: tenantColor || TEAL }}
                >
                  <span className="text-[16px] font-bold text-white">
                    {tenantName.substring(0, 1).toUpperCase()}
                  </span>
                </div>
                <span className="font-display text-[17px] font-bold text-bd-ink">{tenantName}</span>
              </div>
            ) : (
              <Link href="/" aria-label="Beddilo home" className="bd-focus rounded-lg p-1 text-bd-teal">
                <BeddiloWordmark className="h-8 w-auto" title="" />
              </Link>
            )}
          </div>

          {/* Card */}
          <div className="rounded-xl border border-bd-ink/10 bg-white p-6 shadow-[0_1px_2px_rgba(18,36,41,0.04),0_12px_32px_-16px_rgba(18,36,41,0.14)] sm:p-8">
            {children}
          </div>

          {/* Footer */}
          <p className="mt-6 text-center text-[13px] text-bd-slate sm:mt-8">
            {isTenantPage
              ? `© ${new Date().getFullYear()} ${tenantName} · Powered by Beddilo`
              : `© ${new Date().getFullYear()} Beddilo`}
          </p>
        </div>
      </div>
    </div>
  )
}
