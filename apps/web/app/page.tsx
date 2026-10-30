import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, BedDouble, Building2, Home, HandCoins, CalendarCheck, KeyRound, Tag } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { AuthErrorRedirect } from '@/components/auth/auth-error-redirect'
import { ListingCard } from '@/components/public/listing-card'
import { searchListings, type MarketplaceVertical } from '@/lib/directory'
import { photosFirst } from '@/lib/listing-display'
import { MarketplaceNav } from '@/components/marketplace/marketplace-nav'
import { MarketplaceFooter } from '@/components/marketplace/marketplace-footer'
import { HeroSearch, type TabKey } from '@/components/marketplace/hero-search'

/* ──────────────────────────────────────────────────────────────────────────────
   BEDDILO — Marketplace homepage (hostels, hotels, apartments)
   Deep Teal hero · Warm Ivory canvas · Sunny Amber actions · Muted Coral warmth
   Served on gh-hostels.com — the brand changed, the domain did not (see
   NEXT_PUBLIC_VERTICAL_DOMAINS_ENABLED in lib/tenant/host-classification.ts).
   ────────────────────────────────────────────────────────────────────────── */

const SITE_URL = 'https://gh-hostels.com'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Beddilo — Find your stay. Feel at home.',
  description:
    'Discover hotels, student hostels, apartments and beautiful getaways — all in one place. See real-time availability and book directly with the property.',
  keywords: [
    'accommodation booking',
    'book hotels',
    'student hostels',
    'apartments and short-lets',
    'student hostel booking Ghana',
    'Legon hostels',
    'KNUST hostels',
    'UCC hostels',
    'hotel booking Ghana',
  ],
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: 'website',
    locale: 'en_GH',
    url: SITE_URL,
    siteName: 'Beddilo',
    title: 'Beddilo — Find your stay. Feel at home.',
    description:
      'Discover hotels, student hostels, apartments and beautiful getaways — all in one place.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Beddilo — Find your stay. Feel at home.',
    description:
      'Discover hotels, student hostels, apartments and beautiful getaways — all in one place.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  category: 'travel',
}

const orgLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Beddilo',
  slogan: 'A world of stays',
  url: SITE_URL,
  logo: `${SITE_URL}/icons/icon-512.png`,
  description: 'Find and book hotels, student hostels and apartments — and software for the people who run them.',
  foundingLocation: { '@type': 'Place', name: 'Accra, Ghana' },
  areaServed: { '@type': 'Country', name: 'Ghana' },
  sameAs: [
    'https://twitter.com/gh_hostels',
    'https://www.linkedin.com/company/gh-hostels',
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'support@gh-hostels.com',
    contactType: 'customer support',
    areaServed: 'GH',
    availableLanguage: ['English'],
  },
}

const TAB_LABEL: Partial<Record<TabKey, string>> = {
  hostels: 'Hostels',
  hotels: 'Hotels',
  apartments: 'Apartments',
}

const STAY_TYPES = [
  {
    title: 'Student hostels',
    body: 'Rooms near campus, priced by the semester or by the night.',
    href: '/browse?type=hostel',
    icon: BedDouble,
    tone: 'bg-bd-amber-100 text-bd-amber-700',
  },
  {
    title: 'Hotels & guesthouses',
    body: 'From a weekend away to a business trip.',
    href: '/browse?type=hotel',
    icon: Building2,
    tone: 'bg-bd-teal-100 text-bd-teal',
  },
  {
    title: 'Apartments & short-lets',
    body: 'Space to spread out for longer stays.',
    href: '/browse?type=apartment',
    icon: Home,
    tone: 'bg-bd-coral-100 text-bd-coral-700',
  },
] as const

/* Every claim here is backed by how the platform actually works: guest
   payments settle to the property's own Paystack subaccount with no
   platform commission (lib/paystack.ts), availability is read from the
   property's own booking system, and each listing belongs to the tenant
   that runs it. No verification, security or price guarantees. */
const BENEFITS = [
  {
    icon: HandCoins,
    title: 'Book directly',
    body: 'You pay the property itself. Beddilo adds no booking commission to your rate.',
    tone: 'bg-bd-amber-100 text-bd-amber-700',
  },
  {
    icon: CalendarCheck,
    title: 'Real-time availability',
    body: 'Room availability comes straight from each property’s own booking system.',
    tone: 'bg-bd-teal-100 text-bd-teal',
  },
  {
    icon: KeyRound,
    title: 'Listed by the property',
    body: 'Every listing is managed by the people who run the property, not a reseller.',
    tone: 'bg-bd-teal-100 text-bd-teal',
  },
  {
    icon: Tag,
    title: 'Clear pricing',
    body: 'Prices show how they’re billed — per night, per month or per semester.',
    tone: 'bg-bd-coral-100 text-bd-coral-700',
  },
] as const

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const headersList = await headers()
  const host = headersList.get('host') ?? ''
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'gh-hostels.com'
  const rootDomain = appDomain.startsWith('app.') ? appDomain.slice(4) : appDomain
  const isAppDomain = host === rootDomain || host === `app.${rootDomain}` || host === `www.${rootDomain}` || host.includes('localhost')

  if (user && isAppDomain) redirect('/dashboard')

  // The hero search's tab selection round-trips through ?tab= (see
  // hero-search.tsx's selectTab) so this server-rendered Featured section
  // can reflect it too — it has no other way to see that client-side state.
  const { tab: rawTab } = await searchParams
  const tab: TabKey = rawTab === 'hotels' || rawTab === 'apartments' ? rawTab : 'hostels'
  // Computed inline rather than via the imported SEARCH_BUSINESS_TYPE map —
  // that object lookup was observed resolving to `undefined` here (a Server
  // Component) in production despite working fine inside hero-search.tsx
  // (a Client Component), a cross-module bundling quirk in this project's
  // Turbopack build. Inlining removes the ambiguity entirely.
  const featuredBusinessType: MarketplaceVertical =
    tab === 'hotels' ? 'hotel' : tab === 'apartments' ? 'apartment' : 'hostel'
  const tabLabel = TAB_LABEL[tab] ?? 'Hostels'

  // Every listing in the vertical (a regional directory — small): the newest
  // with real photos lead the featured row, the rest still fill it, and
  // their towns become the destination field's suggestions.
  const { listings } = await searchListings({ businessType: featuredBusinessType, limit: 200, sort: 'newest' })
  const featured = photosFirst(listings).slice(0, 6)
  const destinations = Array.from(new Set(listings.map((l) => l.address_city?.trim()).filter((c): c is string => !!c)))
    .sort((a, b) => a.localeCompare(b))

  return (
    <div className="relative min-h-screen bg-bd-ivory text-bd-teal antialiased">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }} />
      <AuthErrorRedirect />

      <MarketplaceNav />

      {/* ── HERO — Deep Teal band + floating search card. Brand colour and
           an arch motif (the doorway inside the "b") instead of stock
           photography: we only ever show real owner-uploaded photos. ─── */}
      <section className="relative overflow-hidden">
        <div className="bd-hero-backdrop absolute inset-0" aria-hidden="true" />
        <HeroArches />

        <div className="relative mx-auto max-w-4xl px-5 pb-28 pt-9 text-center sm:px-6 sm:pb-44 sm:pt-24">
          <p
            className="mp-reveal text-[12px] font-semibold uppercase tracking-[0.32em] text-bd-amber"
            style={{ animationDelay: '40ms' }}
          >
            A world of stays
          </p>
          <h1
            className="mp-reveal mx-auto mt-3 max-w-3xl font-display text-[34px] font-bold leading-[1.05] tracking-[-0.025em] text-bd-ivory min-[375px]:text-[38px] sm:mt-4 sm:text-[58px] md:text-[68px]"
            style={{ animationDelay: '80ms' }}
          >
            Find your stay.{' '}
            <span className="block text-bd-amber">Feel at home.</span>
          </h1>
          <p
            className="mp-reveal mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-bd-ivory/80 sm:mt-5 sm:max-w-xl sm:text-[18px]"
            style={{ animationDelay: '140ms' }}
          >
            Discover hotels, student hostels, apartments and beautiful getaways—all in one place.
          </p>
        </div>
      </section>

      {/* Floating search card — straddles the hero/page boundary */}
      <div className="relative z-10 mx-auto -mt-20 max-w-4xl px-4 sm:-mt-32 sm:px-6">
        <HeroSearch initialTab={tab} destinations={destinations} />
      </div>

      {/* ── FEATURED — real listings for the selected tab ─────────── */}
      <section aria-labelledby="featured-heading" className="mx-auto max-w-6xl px-5 pt-10 sm:px-6 sm:pt-20">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-bd-coral-700">Newly listed</p>
            <h2 id="featured-heading" className="mt-1.5 font-display text-[26px] font-bold tracking-[-0.02em] text-bd-teal sm:text-[32px]">
              Featured {tabLabel.toLowerCase()}
            </h2>
          </div>
          <Link
            href={`/browse?type=${featuredBusinessType}`}
            className="bd-focus group inline-flex items-center gap-1.5 rounded-full text-[14px] font-semibold text-bd-teal underline-offset-4 hover:underline"
          >
            Browse all {tabLabel.toLowerCase()}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </div>

        {featured.length > 0 ? (
          // Phones: a swipeable row with the next card peeking in, instead
          // of a long stack. Wider screens: a grid.
          <ul className="mp-no-scrollbar -mx-5 mt-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-1 sm:mx-0 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 md:grid-cols-3">
            {featured.map((h, i) => (
              <li
                key={h.slug}
                className="mp-reveal w-[80%] max-w-[300px] shrink-0 snap-start sm:w-auto sm:max-w-none"
                style={{ animationDelay: `${280 + Math.min(i, 5) * 70}ms` }}
              >
                <ListingCard listing={h} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mp-reveal mt-6 rounded-3xl border border-dashed border-bd-teal/20 bg-white/60 px-6 py-10 text-center" style={{ animationDelay: '280ms' }}>
            <p className="font-display text-[17px] font-semibold text-bd-teal">New {tabLabel.toLowerCase()} listings are on the way</p>
            <p className="mt-1 text-[14px] text-bd-slate">
              Run a {tab === 'hostels' ? 'hostel near a campus' : tabLabel.toLowerCase().slice(0, -1)}? Be the first to list.
            </p>
            <Link
              href="/list-your-property"
              className="bd-focus mt-5 inline-flex items-center gap-2 rounded-full bg-bd-teal px-5 py-2.5 text-[14px] font-semibold text-bd-ivory transition-colors hover:bg-bd-teal-900"
            >
              List your property <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        )}
      </section>

      {/* ── STAY TYPES — every live vertical, one tap away ───────── */}
      <section aria-labelledby="stay-types-heading" className="mx-auto max-w-6xl px-5 pt-12 sm:px-6 sm:pt-24">
        <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-bd-amber-700">For every journey</p>
        <h2 id="stay-types-heading" className="mt-1.5 font-display text-[26px] font-bold tracking-[-0.02em] text-bd-teal sm:text-[32px]">
          Browse by type of stay
        </h2>
        <div className="mt-5 grid gap-3 sm:mt-6 sm:grid-cols-3 sm:gap-4">
          {STAY_TYPES.map((s) => (
            <Link
              key={s.title}
              href={s.href}
              className="bd-focus group flex items-start gap-4 rounded-2xl border border-bd-teal/10 bg-white p-4 transition-[border-color,box-shadow] duration-200 hover:border-bd-teal/25 hover:shadow-[0_14px_28px_-18px_rgba(23,59,66,0.35)] sm:p-5"
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${s.tone} sm:h-12 sm:w-12 sm:rounded-2xl`}>
                <s.icon className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2 font-display text-[16px] font-semibold text-bd-teal">
                  {s.title}
                  <ArrowRight className="h-4 w-4 shrink-0 text-bd-teal/50 transition-transform group-hover:translate-x-0.5 group-hover:text-bd-teal" aria-hidden="true" />
                </span>
                <span className="mt-1 block text-[14px] leading-relaxed text-bd-slate">{s.body}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── BENEFITS — inclusive, and only what the platform actually does ── */}
      <section aria-labelledby="benefits-heading" className="mx-auto max-w-6xl px-5 py-12 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-xl text-center">
          <h2 id="benefits-heading" className="font-display text-[26px] font-bold tracking-[-0.02em] text-bd-teal sm:text-[32px]">
            Booking, made simple
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-bd-slate sm:text-[16px]">
            Straightforward stays, booked directly with the people who run them.
          </p>
        </div>

        <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-7 sm:mt-10 sm:gap-6 lg:grid-cols-4 lg:gap-0">
          {BENEFITS.map((item, i) => (
            <li
              key={item.title}
              className="mp-reveal flex flex-col items-center text-center sm:px-2 lg:border-l lg:border-bd-teal/10 lg:px-6 lg:first:border-l-0"
              style={{ animationDelay: `${120 + i * 80}ms` }}
            >
              <span className={`flex h-12 w-12 items-center justify-center rounded-full ${item.tone} sm:h-14 sm:w-14`}>
                <item.icon className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
              </span>
              <h3 className="mt-3 font-display text-[15px] font-semibold text-bd-teal sm:mt-4">{item.title}</h3>
              <p className="mt-1 max-w-[260px] text-[13px] leading-relaxed text-bd-slate sm:mt-1.5 sm:text-[14px]">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ── OWNER CTA — routes into the existing onboarding flow ─── */}
      <section className="mx-auto max-w-6xl px-5 pb-12 sm:px-6 sm:pb-24">
        <div className="relative overflow-hidden rounded-[24px] bg-bd-teal px-5 py-8 text-center sm:rounded-[28px] sm:px-12 sm:py-14 md:text-left">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-bd-amber/20 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative flex flex-col items-center gap-8 md:flex-row md:justify-between">
            <div className="max-w-xl">
              <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-bd-amber">For property owners</p>
              <h2 className="mt-2 font-display text-[26px] font-bold tracking-[-0.02em] text-bd-ivory sm:text-[32px]">
                List your property with Beddilo
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-bd-ivory/80 sm:text-[16px]">
                Bring your property to more guests with a simpler way to manage and grow your accommodation business.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row md:shrink-0 md:flex-col lg:flex-row">
              <Link
                href="/list-your-property"
                className="bd-focus-on-dark inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-bd-amber px-6 py-3.5 text-[15px] font-semibold text-bd-teal transition-colors hover:bg-bd-amber-600"
              >
                List your property <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/for-owners"
                className="bd-focus-on-dark inline-flex items-center justify-center whitespace-nowrap rounded-full border border-bd-ivory/30 px-6 py-3.5 text-[15px] font-medium text-bd-ivory transition-colors hover:bg-bd-ivory/10"
              >
                See the management system
              </Link>
            </div>
          </div>
        </div>
      </section>

      <MarketplaceFooter />
    </div>
  )
}

/** Decorative arched doorways — the counter shape of the "b" in the
 *  Beddilo mark — drifting off the hero's edges. */
function HeroArches() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1200 600"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      aria-hidden="true"
    >
      <g stroke="rgb(247 242 233 / 0.07)" strokeWidth="2">
        <path d="M-60 640V300a170 170 0 0 1 340 0v340" />
        <path d="M-10 640V320a120 120 0 0 1 240 0v320" />
        <path d="M940 640V250a190 190 0 0 1 380 0v390" />
        <path d="M995 640V275a135 135 0 0 1 270 0v365" />
      </g>
    </svg>
  )
}
