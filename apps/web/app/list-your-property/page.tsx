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
      tone: 'bg-bd-amber-100 text-bd-amber-700',
      href: hostelHref,
      enabled: true,
    },
    {
      key: 'hotels',
      label: 'Hotels',
      description: 'Full-service hotels, guesthouses, and lodges.',
      icon: Building2,
      tone: 'bg-bd-teal-100 text-bd-teal',
      href: hotelHref,
      enabled: true,
    },
    {
      key: 'apartments',
      label: 'Apartments',
      description: 'Serviced apartments and short-let units.',
      icon: Home,
      tone: 'bg-bd-coral-100 text-bd-coral-700',
      // Apartments share the hotel vertical (same business_type='hotel'
      // tenant record and management dashboard) rather than being a
      // distinct third vertical — so this points at the exact same page
      // as Hotels, not a separate apartment-specific one.
      href: hotelHref,
      enabled: true,
    },
  ] as const

  return (
    <div className="relative min-h-screen bg-bd-ivory text-bd-teal">
      <MarketplaceNav />

      <section className="relative overflow-hidden">
        <div className="bd-hero-backdrop absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-3xl px-5 pb-20 pt-9 text-center sm:px-6 sm:pb-36 sm:pt-20">
          <p className="text-[12px] font-semibold uppercase tracking-[0.28em] text-bd-amber">
            For property owners
          </p>
          <h1 className="mx-auto mt-3 max-w-2xl font-display text-[30px] font-bold leading-[1.08] tracking-[-0.025em] text-bd-ivory min-[375px]:text-[32px] sm:mt-4 sm:text-[48px]">
            List your property with Beddilo
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-bd-ivory/80 sm:mt-4 sm:text-[17px]">
            Bring your property to more guests with a simpler way to manage and grow your accommodation business.
          </p>
          <h2 id="property-type-heading" className="mt-6 text-[15px] font-semibold text-bd-ivory sm:mt-8">
            What would you like to list? <span className="font-normal text-bd-ivory/75">Choose one to get started.</span>
          </h2>
        </div>
      </section>

      <div className="relative z-10 mx-auto -mt-12 max-w-4xl px-4 pb-14 sm:-mt-24 sm:px-6 sm:pb-28">
        <ul aria-labelledby="property-type-heading" className="grid gap-3 sm:grid-cols-3 sm:gap-4">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon
            const card = (
              <div
                className={`flex h-full items-center gap-4 rounded-2xl border border-bd-teal/10 bg-white p-4 text-left shadow-[0_20px_40px_-30px_rgba(11,31,35,0.5)] transition-[border-color,box-shadow] duration-200 sm:flex-col sm:items-start sm:rounded-3xl sm:p-6 ${
                  opt.enabled ? 'group-hover:border-bd-teal/25 group-hover:shadow-[0_24px_48px_-28px_rgba(11,31,35,0.45)]' : ''
                }`}
              >
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl sm:h-14 sm:w-14 sm:rounded-2xl ${opt.tone}`}>
                  <Icon className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={1.8} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1 sm:flex-none">
                  <span className="flex items-center gap-2">
                    <span className="font-display text-[17px] font-bold text-bd-teal sm:text-[19px]">{opt.label}</span>
                    {!opt.enabled && (
                      <span className="rounded-full bg-bd-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-bd-amber-700">
                        Soon
                      </span>
                    )}
                  </span>
                  <p className="mt-0.5 text-[14px] leading-snug text-bd-slate sm:mt-1.5 sm:leading-relaxed">{opt.description}</p>
                </div>
                {opt.enabled && (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bd-teal text-bd-ivory transition-colors group-hover:bg-bd-teal-900 sm:mt-auto sm:h-auto sm:w-auto sm:gap-2 sm:px-4 sm:py-2.5 sm:text-[14px] sm:font-semibold">
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
                    className="bd-focus group block h-full rounded-2xl sm:rounded-3xl"
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

        <p className="mt-8 text-center text-[14px] text-bd-slate sm:mt-10">
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
