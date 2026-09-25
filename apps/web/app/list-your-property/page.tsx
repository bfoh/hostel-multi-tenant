import type { Metadata } from 'next'
import Link from 'next/link'
import { BedDouble, Building2, Home, ArrowRight } from 'lucide-react'
import { MarketplaceNav } from '@/components/marketplace/marketplace-nav'
import { MarketplaceFooter } from '@/components/marketplace/marketplace-footer'
import { MP } from '@/lib/marketplace-theme'
import { bareRootDomain, verticalRootDomain } from '@/lib/tenant/host-classification'

export const metadata: Metadata = {
  title: 'List Your Property — Aya',
  description: 'List your hostel, hotel, or apartment on Aya and get discovered by guests across Ghana.',
}

/**
 * The owner-facing entry point, modeled on the Expedia Partner Central
 * "What would you like to list?" pattern — one property-type chooser that
 * routes into the right vertical's onboarding, rather than a single
 * hostel-only CTA. Hotels and apartments share the same hotel-management
 * application (an apartment owner runs a smaller version of the same
 * property), so both route to the hotel vertical.
 *
 * Before the DNS/domain cutover (NEXT_PUBLIC_VERTICAL_DOMAINS_ENABLED),
 * both the hostel and hotel paths fall back to today's /for-owners on the
 * current host (?type=hotel for the hotel one) — hostels.<domain> and
 * hotels.<domain> don't resolve yet. Hotels went live 2026-09-25 (pricing,
 * signup, onboarding, dashboard, and Paystack subscriptions all verified
 * end-to-end first). Apartments still route nowhere ("Soon") — they're
 * meant to share the hotel vertical too, but that hasn't been decided on
 * yet, separately from today's hotel launch.
 */
export default function ListYourPropertyPage() {
  const verticalDomainsLive = process.env.NEXT_PUBLIC_VERTICAL_DOMAINS_ENABLED === 'true'
  const rootDomain = bareRootDomain(process.env.NEXT_PUBLIC_APP_DOMAIN)
  const hostelHref = verticalDomainsLive ? `https://${verticalRootDomain(rootDomain, 'hostel')}` : '/for-owners'
  const hotelHref  = verticalDomainsLive ? `https://${verticalRootDomain(rootDomain, 'hotel')}`  : '/for-owners?type=hotel'

  const OPTIONS = [
    {
      key: 'hostels',
      label: 'Hostels',
      description: 'Student and shared-room accommodation near campuses.',
      icon: BedDouble,
      href: hostelHref,
      enabled: true,
    },
    {
      key: 'hotels',
      label: 'Hotels',
      description: 'Full-service hotels, guesthouses, and lodges.',
      icon: Building2,
      href: hotelHref,
      enabled: true,
    },
    {
      key: 'apartments',
      label: 'Apartments',
      description: 'Serviced apartments and short-let units.',
      icon: Home,
      href: null,
      enabled: false,
    },
  ] as const

  return (
    <div className="relative min-h-screen" style={{ background: MP.bg }}>
      <div className="pointer-events-none fixed inset-0 -z-10 platform-adinkra-bg-light" aria-hidden="true" />

      <MarketplaceNav />

      <div className="mx-auto max-w-4xl px-5 pb-24 pt-16 text-center sm:px-6 sm:pt-24">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: MP.goldDeep }}>
          For property owners
        </p>
        <h1
          className="mx-auto mt-3 max-w-xl text-[32px] font-normal leading-[1.1] tracking-[-0.02em] sm:text-[44px]"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif', color: MP.ink }}
        >
          List your property with Aya
        </h1>
        <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed" style={{ color: MP.textSecondary }}>
          What would you like to list? Choose one to get started.
        </p>

        <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-3">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon
            const card = (
              <div
                className={`group flex h-full flex-col items-center gap-3 rounded-2xl p-6 text-center transition-all duration-200 ${
                  opt.enabled ? 'hover:-translate-y-0.5 hover:shadow-lg' : ''
                }`}
                style={{ background: MP.surface, border: `1px solid ${MP.border}` }}
              >
                <span
                  className="flex h-14 w-14 items-center justify-center rounded-full"
                  style={{ background: MP.surfaceSoft }}
                >
                  <Icon className="h-6 w-6" style={{ color: opt.enabled ? MP.green : MP.textSecondary }} />
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[16px] font-bold" style={{ color: MP.ink }}>{opt.label}</span>
                  {!opt.enabled && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                      style={{ background: MP.surfaceSoft, color: MP.goldDeep }}
                    >
                      Soon
                    </span>
                  )}
                </div>
                <p className="text-[13px] leading-relaxed" style={{ color: MP.textSecondary }}>{opt.description}</p>
                {opt.enabled && (
                  <span
                    className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-semibold transition-transform duration-200 group-hover:translate-x-0.5"
                    style={{ color: MP.green }}
                  >
                    Get started <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
            )

            return opt.enabled && opt.href ? (
              <Link key={opt.key} href={opt.href} className="block h-full">
                {card}
              </Link>
            ) : (
              <div key={opt.key} className="h-full cursor-default opacity-70">
                {card}
              </div>
            )
          })}
        </div>

        <p className="mt-10 text-[13px]" style={{ color: MP.textSecondary }}>
          Already have an account?{' '}
          <Link href="/login" className="font-semibold hover:underline" style={{ color: MP.green }}>
            Sign in
          </Link>
        </p>
      </div>

      <MarketplaceFooter />
    </div>
  )
}
