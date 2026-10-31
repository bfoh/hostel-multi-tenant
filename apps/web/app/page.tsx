import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Check, HandCoins, CalendarCheck, KeyRound, Tag } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { AuthErrorRedirect } from '@/components/auth/auth-error-redirect'
import { ListingCard } from '@/components/public/listing-card'
import { searchListings, type MarketplaceVertical } from '@/lib/directory'
import { photosFirst, townsWithListings } from '@/lib/listing-display'
import { townSearchHref, type TabKey } from '@/lib/marketplace-search'
import { MarketplaceNav } from '@/components/marketplace/marketplace-nav'
import { MarketplaceFooter } from '@/components/marketplace/marketplace-footer'
import { HeroSearch } from '@/components/marketplace/hero-search'
import { KindsOfStay, KINDS_PHOTOS, PhotoCredits } from '@/components/marketplace/kinds-of-stay'

/* ──────────────────────────────────────────────────────────────────────────────
   BEDDILO — Marketplace homepage (hostels, hotels, apartments)
   A light ivory hero with a one-row search, the kinds of stay, then real
   listings with town filters, why to book here and an owner invitation.
   Only real listings and real claims; the place photos are credited and
   never shown as a property.
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

const TAB_NOUN: Record<TabKey, { one: string; many: string; heading: string }> = {
  hostels: { one: 'hostel', many: 'hostels', heading: 'Student hostels' },
  hotels: { one: 'hotel', many: 'hotels', heading: 'Hotels' },
  apartments: { one: 'apartment', many: 'apartments', heading: 'Apartments' },
}

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
  },
  {
    icon: CalendarCheck,
    title: 'Live availability',
    body: 'Rooms and beds come straight from each property’s own booking system.',
  },
  {
    icon: KeyRound,
    title: 'Listed by the property',
    body: 'Every listing is run by the people who manage the property, not a reseller.',
  },
  {
    icon: Tag,
    title: 'Clear pricing',
    body: 'Prices show how they’re billed: per night, per month or per semester.',
  },
] as const

/* From the owner offer on /for-owners: the 30-day trial with no card, Paystack
   MoMo and card payments, and a listing that stays up after the trial. */
const OWNER_POINTS = [
  'Free for 30 days, no card needed',
  'MoMo and card payments through Paystack',
  'Bookings, rooms and payments in one dashboard',
  'Your listing stays up after the trial',
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
  // hero-search.tsx's selectTab) so the server-rendered sections below can
  // follow it — they have no other way to see that client-side state.
  const { tab: rawTab } = await searchParams
  const tab: TabKey = rawTab === 'hotels' || rawTab === 'apartments' ? rawTab : 'hostels'
  // Computed inline rather than via SEARCH_BUSINESS_TYPE, which once
  // resolved to undefined here when it was imported from the client
  // component (now it lives in lib/marketplace-search.ts).
  const featuredBusinessType: MarketplaceVertical =
    tab === 'hotels' ? 'hotel' : tab === 'apartments' ? 'apartment' : 'hostel'
  const noun = TAB_NOUN[tab]
  const browseAllHref = featuredBusinessType === 'hostel' ? '/browse' : `/browse?type=${featuredBusinessType}`

  // Every listing in the vertical (a regional directory — small): the newest
  // with real photos lead the featured row, the rest still fill it, and
  // their towns become the popular searches, the town filters and the town
  // field's suggestions, so each of those finds at least one property. The
  // other two verticals only need their totals, for the kinds of stay.
  const [{ listings, total }, ...others] = await Promise.all([
    searchListings({ businessType: featuredBusinessType, limit: 200, sort: 'newest' }),
    ...(['hostel', 'hotel', 'apartment'] as const)
      .filter((v) => v !== featuredBusinessType)
      .map(async (v) => [v, (await searchListings({ businessType: v, limit: 1 })).total] as const),
  ])
  const counts = Object.fromEntries([[featuredBusinessType, total], ...others]) as Record<MarketplaceVertical, number>
  const featured = photosFirst(listings).slice(0, 8)
  const towns = townsWithListings(listings)

  return (
    <div className="relative min-h-screen bg-white text-bd-ink antialiased">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }} />
      <AuthErrorRedirect />

      <MarketplaceNav />

      {/* ── HERO — light ivory, one-row search. No photo of a property:
           listing photos only ever come from owners. ─────────────── */}
      <section aria-labelledby="hero-heading" className="border-b border-bd-ink/10 bg-bd-ivory-50">
        <div className="mx-auto max-w-6xl px-5 pb-10 pt-10 sm:px-6 sm:pb-14 sm:pt-16">
          <p className="text-[15px] font-semibold text-bd-teal">A world of stays</p>
          <h1 id="hero-heading" className="mt-2 max-w-3xl font-display text-[32px] font-bold leading-[1.1] tracking-[-0.02em] sm:text-[46px]">
            Find a place to stay in Ghana
          </h1>
          <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-bd-slate sm:text-[18px]">
            Student hostels near campus, hotels and apartments. Compare rooms and
            prices, then book directly with the property.
          </p>
          <div className="mt-7 max-w-4xl">
            <HeroSearch initialTab={tab} destinations={towns.map((t) => t.town)} />
          </div>
          {towns.length > 0 && (
            <nav aria-label={`Popular ${noun.many} searches`} className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px]">
              <span className="text-bd-slate">Popular:</span>
              {towns.slice(0, 6).map((t) => (
                <Link
                  key={t.town}
                  href={townSearchHref(t.town, featuredBusinessType)}
                  className="bd-focus rounded font-medium text-bd-ink underline decoration-bd-ink/25 underline-offset-4 hover:decoration-bd-ink"
                >
                  {t.town}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </section>

      {/* ── KINDS OF STAY — place photos, live counts ─────────────── */}
      <section aria-labelledby="kinds-heading" className="mx-auto max-w-6xl px-5 pt-14 sm:px-6 sm:pt-20">
        <h2 id="kinds-heading" className="font-display text-[24px] font-bold tracking-[-0.015em] sm:text-[30px]">
          Explore your kind of stay
        </h2>
        <KindsOfStay counts={counts} />
      </section>

      {/* ── LISTINGS — real listings for the selected tab ─────────── */}
      <section aria-labelledby="featured-heading" className="mx-auto max-w-6xl px-5 pt-14 sm:px-6 sm:pt-20">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="featured-heading" className="font-display text-[24px] font-bold tracking-[-0.015em] sm:text-[30px]">
              {noun.heading} on Beddilo
            </h2>
            {total > 0 && (
              <p className="mt-1 text-[15px] text-bd-slate">
                {total} {total === 1 ? noun.one : noun.many}
                {towns.length > 0 && ` in ${towns.length} town${towns.length === 1 ? '' : 's'}`}, newest first
              </p>
            )}
          </div>
          {total > 0 && (
            <Link
              href={browseAllHref}
              className="bd-focus group hidden shrink-0 items-center gap-1.5 rounded-md text-[15px] font-semibold text-bd-teal hover:underline hover:underline-offset-4 sm:inline-flex"
            >
              See all {noun.many}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          )}
        </div>

        {towns.length > 1 && (
          <nav aria-label={`${noun.heading} by town`} className="mt-5 flex flex-wrap gap-2">
            {towns.map((t) => (
              <Link
                key={t.town}
                href={townSearchHref(t.town, featuredBusinessType)}
                className="bd-focus inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-bd-ink/15 bg-white px-4 text-[14px] font-medium text-bd-ink transition-colors hover:border-bd-ink/40"
              >
                {t.town} <span className="text-bd-slate">{t.count}</span>
              </Link>
            ))}
          </nav>
        )}

        {featured.length > 0 ? (
          <>
            {/* Phones: compact rows. Wider screens: a photo grid. */}
            <ul className="mt-6 grid gap-5 sm:grid-cols-2 sm:gap-y-9 lg:grid-cols-4">
              {featured.map((h, i) => (
                // Four columns on wide screens: show one full row unless
                // there are eight to fill two, never a half-empty row.
                <li
                  key={h.slug}
                  className={`border-b border-bd-ink/10 pb-5 last:border-0 sm:border-0 sm:pb-0 ${i >= 4 && featured.length < 8 ? 'lg:hidden' : ''}`}
                >
                  <ListingCard listing={h} rowOnPhone />
                </li>
              ))}
            </ul>
            <Link
              href={browseAllHref}
              className="bd-focus mt-6 flex min-h-[48px] items-center justify-center gap-1.5 rounded-lg border border-bd-ink/20 text-[15px] font-semibold text-bd-ink sm:hidden"
            >
              See all {total} {total === 1 ? noun.one : noun.many} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </>
        ) : (
          <div className="mt-6 rounded-xl bg-bd-mist px-6 py-10 text-center">
            <p className="text-[17px] font-semibold">No {noun.many} listed yet</p>
            <p className="mt-1 text-[15px] text-bd-slate">
              Run {tab === 'apartments' ? 'an' : 'a'} {noun.one}? Be the first to list it on Beddilo.
            </p>
            <Link
              href="/list-your-property"
              className="bd-focus mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-bd-teal px-5 text-[15px] font-semibold text-white transition-colors hover:bg-bd-teal-900"
            >
              List your property <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        )}
      </section>

      {/* ── WHY BEDDILO — only what the platform actually does ───── */}
      <section aria-labelledby="why-heading" className="mx-auto max-w-6xl px-5 pt-16 sm:px-6 sm:pt-24">
        <h2 id="why-heading" className="font-display text-[24px] font-bold tracking-[-0.015em] sm:text-[30px]">
          Why book with Beddilo
        </h2>
        <ul className="mt-6 grid gap-x-8 gap-y-6 sm:mt-8 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((item) => (
            <li key={item.title} className="flex gap-4 sm:block">
              <item.icon className="h-6 w-6 shrink-0 text-bd-teal" strokeWidth={1.75} aria-hidden="true" />
              <div>
                <h3 className="text-[16px] font-semibold sm:mt-3">{item.title}</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-bd-slate">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ── OWNERS — routes into the existing onboarding flow ─────── */}
      <section aria-labelledby="owners-heading" className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-24">
        <div className="grid gap-8 rounded-2xl bg-bd-teal p-6 text-white sm:p-10 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:gap-14 lg:p-12">
          <div>
            <h2 id="owners-heading" className="font-display text-[26px] font-bold leading-tight tracking-[-0.015em] text-white sm:text-[32px]">
              Run a hostel, hotel or apartment?
            </h2>
            <p className="mt-3 max-w-lg text-[16px] leading-relaxed text-white/80">
              List it on Beddilo, take bookings online and manage rooms, residents and payments from one place.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/list-your-property"
                className="bd-focus-on-dark inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-bd-amber px-6 text-[15px] font-semibold text-bd-teal transition-colors hover:bg-bd-amber-300"
              >
                List your property <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/for-owners"
                className="bd-focus-on-dark inline-flex min-h-[48px] items-center justify-center rounded-lg border border-white/30 px-6 text-[15px] font-semibold text-white transition-colors hover:bg-white/10"
              >
                See how it works
              </Link>
            </div>
          </div>
          <ul className="grid gap-3.5">
            {OWNER_POINTS.map((point) => (
              <li key={point} className="flex gap-3 text-[15px] leading-snug text-white/90">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-bd-amber" strokeWidth={2.2} aria-hidden="true" />
                {point}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 pb-10 sm:px-6">
        <PhotoCredits photos={KINDS_PHOTOS} />
      </div>
      <MarketplaceFooter />
    </div>
  )
}
