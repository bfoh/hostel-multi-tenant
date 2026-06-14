import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Sign in — GH-HOSTELS' }

const HAIR = 'rgba(245, 233, 210, 0.10)'
const HAIR_STRONG = 'rgba(245, 233, 210, 0.18)'
const INK = '#0A0A08'
const IVORY = '#F5E9D2'
const FOREST_MID = '#1B6E54'
const GOLD = '#D4A24C'
const GOLD_SOFT = '#F5C26B'

/**
 * Auth layout — Ghanaian premium palette.
 * Full-screen ink with forest+gold ambient. Tenant-branded variant: brand-color
 * accents on top of the same dark canvas.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const headersList  = await headers()
  const tenantName   = headersList.get('x-tenant-name')
  const tenantLogo   = headersList.get('x-tenant-logo')
  const tenantColor  = headersList.get('x-tenant-color')
  const isTenantPage = !!tenantName

  const accentA = isTenantPage && tenantColor ? tenantColor : FOREST_MID
  const accentB = isTenantPage && tenantColor ? tenantColor : GOLD

  return (
    <div
      className="relative flex min-h-[100dvh] items-center justify-center px-4 py-12 selection:bg-[#D4A24C]/40"
      style={{ background: INK, color: IVORY }}
    >
      {/* ── Ambient mesh background ───────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute -left-32 -top-32 h-[560px] w-[560px] rounded-full opacity-[0.20] blur-[140px]"
          style={{ background: accentA }}
        />
        <div
          className="absolute -bottom-40 -right-40 h-[640px] w-[640px] rounded-full opacity-[0.16] blur-[160px]"
          style={{ background: accentB }}
        />
        <div
          className="absolute left-1/2 top-1/2 h-[320px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.10] blur-[120px]"
          style={{ background: accentB }}
        />
      </div>

      {/* ── Back link ─────────────────────────────────────────────── */}
      <div className="absolute left-6 top-6 z-20">
        <Link
          href={isTenantPage ? '/' : 'https://gh-hostels.com'}
          className="flex items-center gap-1.5 text-[13px] font-medium transition-colors"
          style={{ color: 'rgba(245,233,210,0.55)' }}
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
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
                style={{ background: `linear-gradient(135deg, ${accentA}, ${accentB})` }}
              >
                <span className="text-[16px] font-bold text-white">
                  {tenantName.substring(0, 1).toUpperCase()}
                </span>
              </div>
              <span
                className="text-[15px] font-bold tracking-[0.16em]"
                style={{ color: IVORY, fontFamily: 'Plus Jakarta Sans, Inter, sans-serif' }}
              >
                {tenantName}
              </span>
            </div>
          ) : (
            <Link href="https://gh-hostels.com" className="mb-4 flex items-center gap-2.5 group">
              <Image
                src="/logo-mark.svg"
                alt="GH-HOSTELS"
                width={40}
                height={40}
                className="h-10 w-10 transition-transform duration-500 group-hover:rotate-[6deg]"
                priority
              />
              <span
                className="text-[15px] font-bold tracking-[0.16em]"
                style={{ color: IVORY, fontFamily: 'Plus Jakarta Sans, Inter, sans-serif' }}
              >
                GH-HOSTELS
              </span>
            </Link>
          )}
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            border: `1px solid ${HAIR_STRONG}`,
            background:
              'linear-gradient(180deg, rgba(245,233,210,0.03) 0%, rgba(245,233,210,0.005) 100%)',
            boxShadow: `0 30px 80px -30px rgba(15,76,58,0.55), 0 0 80px -20px ${GOLD_SOFT}14`,
          }}
        >
          {children}
        </div>

        {/* Footer */}
        <p
          className="mt-8 text-center text-[11px]"
          style={{ color: 'rgba(245,233,210,0.4)' }}
        >
          {isTenantPage
            ? `© ${new Date().getFullYear()} ${tenantName}. Powered by GH-HOSTELS.`
            : `© ${new Date().getFullYear()} GH-HOSTELS · Made in Accra, Ghana`}
        </p>
      </div>

      {/* Silence unused-var noise for stable HAIR token */}
      <span className="hidden" data-hair={HAIR} />
    </div>
  )
}
