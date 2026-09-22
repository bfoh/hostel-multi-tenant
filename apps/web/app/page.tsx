import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { MapPin, Search } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { AuthErrorRedirect } from '@/components/auth/auth-error-redirect'
import { HostelCard } from '@/components/public/hostel-card'
import { searchHostels } from '@/lib/directory'
import { MarketplaceNav } from '@/components/marketplace/marketplace-nav'
import { MarketplaceFooter } from '@/components/marketplace/marketplace-footer'
import { MP } from '@/lib/marketplace-theme'

/* ──────────────────────────────────────────────────────────────────────────────
   GH HOSTELS — Marketplace homepage
   Light mode · Forest green · Warm gold · Adinkra-inspired background
   ────────────────────────────────────────────────────────────────────────── */

const SITE_URL = 'https://gh-hostels.com'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'GH Hostels — Find & Book Student Hostels in Ghana',
  description:
    'Search real-time availability and book student hostels near your campus in Ghana — Legon, KNUST, UCC, and beyond. No middleman. Run a hostel? List yours free.',
  keywords: [
    'student hostel booking Ghana',
    'hostel near me Ghana',
    'Legon hostels',
    'KNUST hostels',
    'UCC hostels',
    'book student accommodation Ghana',
    'hostel management software Ghana',
    'Ghana hostel SaaS',
  ],
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: 'website',
    locale: 'en_GH',
    url: SITE_URL,
    siteName: 'GH Hostels',
    title: 'GH Hostels — Find & Book Student Hostels in Ghana',
    description:
      'Search real-time availability and book student hostels near your campus in Ghana. No middleman.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GH Hostels — Find & Book Student Hostels in Ghana',
    description:
      'Search real-time availability and book student hostels near your campus in Ghana.',
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
  category: 'business',
}

const orgLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'GH Hostels',
  url: SITE_URL,
  logo: `${SITE_URL}/icons/icon.svg`,
  description: 'Search and book student hostels across Ghana, and hostel management software for owners.',
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
    availableLanguage: ['English', 'Twi'],
  },
}

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const headersList = await headers()
  const host = headersList.get('host') ?? ''
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'gh-hostels.com'
  const rootDomain = appDomain.startsWith('app.') ? appDomain.slice(4) : appDomain
  const isAppDomain = host === rootDomain || host === `app.${rootDomain}` || host === `www.${rootDomain}` || host.includes('localhost')

  if (user && isAppDomain) redirect('/dashboard')

  const { hostels: featuredHostels, total: totalListed } = await searchHostels({ limit: 6, sort: 'newest' })

  return (
    <div className="relative min-h-screen antialiased" style={{ background: MP.bg }}>
      <div className="pointer-events-none fixed inset-0 -z-10 platform-adinkra-bg-light" aria-hidden="true" />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }} />
      <AuthErrorRedirect />

      <MarketplaceNav />

      {/* ── HERO — search-first, Booking.com-style front door ────── */}
      <section className="relative overflow-hidden" style={{ borderBottom: `1px solid ${MP.border}` }}>
        <div className="relative mx-auto max-w-5xl px-5 pb-16 pt-16 text-center sm:px-6 sm:pb-24 sm:pt-24">
          <div
            className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em]"
            style={{ border: `1px solid ${MP.border}`, background: MP.surfaceSoft, color: MP.greenDeep }}
          >
            <span className="relative h-1.5 w-1.5 rounded-full" style={{ background: MP.gold }} />
            {totalListed} hostels listed across Ghana
          </div>

          <h1
            className="mx-auto max-w-3xl text-[36px] font-normal leading-[1.08] tracking-[-0.03em] sm:text-[52px] md:text-[64px]"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif', color: MP.ink }}
          >
            Find your next hostel.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed sm:text-[17px]" style={{ color: MP.textSecondary }}>
            Search real-time availability near your campus, book directly, no middleman.
          </p>

          <form
            action="/hostels"
            method="get"
            className="mx-auto mt-9 flex max-w-2xl flex-col gap-2 rounded-2xl bg-white p-2.5 shadow-sm sm:flex-row sm:items-center"
            style={{ border: `1px solid ${MP.border}` }}
          >
            <div className="flex flex-1 items-center gap-2 rounded-xl px-4 py-3" style={{ background: MP.surfaceSoft }}>
              <Search className="h-4 w-4 shrink-0" style={{ color: MP.goldDeep }} />
              <input
                name="q"
                placeholder="Hostel name or campus — Legon, KNUST, UCC…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
                style={{ color: MP.ink }}
              />
            </div>
            <div className="flex items-center gap-2 rounded-xl px-4 py-3 sm:w-44" style={{ background: MP.surfaceSoft }}>
              <MapPin className="h-4 w-4 shrink-0" style={{ color: MP.goldDeep }} />
              <input
                name="city"
                placeholder="City"
                className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
                style={{ color: MP.ink }}
              />
            </div>
            <button
              type="submit"
              className="shrink-0 rounded-xl px-6 py-3 text-sm font-semibold text-white"
              style={{ background: MP.green }}
            >
              Search
            </button>
          </form>

          {featuredHostels.length > 0 && (
            <div className="mx-auto mt-14 grid max-w-4xl gap-4 text-left sm:grid-cols-3">
              {featuredHostels.slice(0, 3).map((h) => (
                <HostelCard key={h.slug} hostel={h} />
              ))}
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px]" style={{ color: MP.textSecondary }}>
            <Link href="/hostels" className="font-medium hover:underline">Browse all hostels →</Link>
            <span aria-hidden="true">·</span>
            <Link href="/signup?plan=trial&source=directory" className="font-medium hover:underline">
              Run a hostel? List yours free →
            </Link>
          </div>
        </div>
      </section>

      <MarketplaceFooter />
    </div>
  )
}
