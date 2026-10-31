import type { Metadata } from 'next'
import Link from 'next/link'
import { BedDouble, Building2, Home, ArrowRight } from 'lucide-react'
import { MarketplaceNav } from '@/components/marketplace/marketplace-nav'
import { MarketplaceFooter } from '@/components/marketplace/marketplace-footer'
import { bareRootDomain, verticalRootDomain } from '@/lib/tenant/host-classification'

export const metadata: Metadata = {
  title: { absolute: 'List Your Property — Beddilo' },
  description: 'List your hostel, hotel or apartment on Beddilo. Bring your property to more guests with a simpler way to manage and grow your accommodation business.',
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
 * the hostel path falls back to today's /for-owners on the current host,
 * and both hotels and apartments fall back to /for-owners?type=hotel (the
 * same page — apartments have no distinct marketing content of their own
 * since they share the hotel vertical end to end). Hostels + hotels went
 * live 2026-09-25, apartments 2026-09-26.
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
      // Apartments share the hotel vertical (same business_type='hotel'
      // tenant record and management dashboard) rather than being a
      // distinct third vertical — so this points at the exact same page
      // as Hotels, not a separate apartment-specific one.
      href: hotelHref,
      enabled: true,
    },
  ] as const

  return (
    <div className="relative min-h-screen bg-white text-bd-ink">
      <MarketplaceNav />

      <section className="bg-bd-teal">
        <div className="mx-auto max-w-6xl px-5 pb-24 pt-10 sm:px-6 sm:pb-28 sm:pt-16">
          <h1 className="max-w-2xl font-display text-[30px] font-bold leading-[1.1] tracking-[-0.02em] text-white sm:text-[44px]">
            List your property on Beddilo
          </h1>
          <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-white/80 sm:mt-4 sm:text-[18px]">
            Reach guests and students looking for a place to stay, and run bookings, rooms and payments from one dashboard.
          </p>
        </div>
      </section>

      <div className="relative z-10 mx-auto -mt-14 max-w-6xl px-4 pb-16 sm:-mt-16 sm:px-6 sm:pb-24">
        <div className="rounded-xl border border-bd-ink/10 bg-white p-4 shadow-[0_18px_40px_-20px_rgba(11,31,35,0.35)] sm:p-6">
          <h2 id="property-type-heading" className="text-[17px] font-semibold">
            What would you like to list?
          </h2>
          <ul aria-labelledby="property-type-heading" className="mt-4 grid gap-3 sm:grid-cols-3">
            {OPTIONS.map((opt) => {
              const Icon = opt.icon
              const card = (
                <div className="flex h-full items-center gap-4 rounded-lg border border-bd-ink/12 p-4 transition-colors group-hover:border-bd-teal group-hover:bg-bd-mist sm:flex-col sm:items-start sm:p-5">
                  <Icon className="h-7 w-7 shrink-0 text-bd-teal" strokeWidth={1.6} aria-hidden="true" />
                  <div className="min-w-0 flex-1 sm:flex-none">
                    <span className="flex items-center gap-2">
                      <span className="text-[17px] font-semibold">{opt.label}</span>
                      {!opt.enabled && (
                        <span className="rounded-md bg-bd-mist px-2 py-0.5 text-[12px] font-medium text-bd-slate">
                          Coming soon
                        </span>
                      )}
                    </span>
                    <p className="mt-0.5 text-[14px] leading-snug text-bd-slate sm:mt-1 sm:leading-relaxed">{opt.description}</p>
                  </div>
                  {opt.enabled && (
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-[14px] font-semibold text-bd-teal sm:mt-auto sm:pt-2">
                      <span className="hidden sm:inline">Get started</span>
                      <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
                    </span>
                  )}
                </div>
              )

              return (
                <li key={opt.key}>
                  {opt.enabled && opt.href ? (
                    <Link
                      href={opt.href}
                      aria-label={`List ${opt.label.toLowerCase()} — get started`}
                      className="bd-focus group block h-full rounded-lg"
                    >
                      {card}
                    </Link>
                  ) : (
                    <div className="h-full cursor-default opacity-70">{card}</div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>

        <p className="mt-6 text-[15px] text-bd-slate">
          Already have an account?{' '}
          <Link href="/login" className="bd-focus rounded-sm font-semibold text-bd-teal underline underline-offset-4 hover:text-bd-teal-600">
            Sign in
          </Link>
        </p>
      </div>

      <MarketplaceFooter />
    </div>
  )
}
