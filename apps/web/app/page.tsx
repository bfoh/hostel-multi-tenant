import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { MapPin, Search, ShieldCheck, Zap, HandCoins } from 'lucide-react'

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

      {/* ── HERO — immersive band + floating search card. Inspired by the
           classic "photo hero + floating search card" travel-site pattern,
           adapted to our own green/gold + Adinkra graphic language instead
           of stock photography we don't have (using someone else's hostel
           photo — or a generic stock one — as our own brand hero would be
           dishonest either way). ────────────────────────────────────── */}
      <section className="relative">
        <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(160deg, ${MP.greenDeep} 0%, ${MP.green} 60%, ${MP.goldDeep} 145%)` }}
          />
          <div className="mp-hero-adinkra absolute inset-0" />
        </div>

        <div className="relative mx-auto max-w-3xl px-5 pb-32 pt-16 text-center sm:px-6 sm:pb-40 sm:pt-24">
          <div
            className="mp-reveal mx-auto mb-6 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em]"
            style={{ border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.1)', color: MP.goldSoft }}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: MP.goldSoft }} />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: MP.goldSoft }} />
            </span>
            {totalListed} hostels listed across Ghana
          </div>

          <h1
            className="mp-reveal mx-auto max-w-2xl text-[36px] font-normal leading-[1.08] tracking-[-0.03em] text-white sm:text-[52px] md:text-[60px]"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif', animationDelay: '60ms' }}
          >
            Find your next hostel.
          </h1>
          <p
            className="mp-reveal mx-auto mt-5 max-w-xl text-[15px] leading-relaxed sm:text-[17px]"
            style={{ color: 'rgba(255,255,255,0.8)', animationDelay: '120ms' }}
          >
            Search real-time availability near your campus, book directly, no middleman.
          </p>
        </div>
      </section>

      {/* Floating search card — straddles the hero/page boundary */}
      <div className="relative z-10 mx-auto -mt-20 max-w-2xl px-5 sm:-mt-24 sm:px-6">
        <form
          action="/hostels"
          method="get"
          className="mp-reveal mx-auto flex flex-col gap-2 rounded-2xl bg-white p-2.5 shadow-xl sm:flex-row sm:items-center"
          style={{ animationDelay: '180ms' }}
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
            className="shrink-0 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
            style={{ background: MP.green }}
          >
            Search
          </button>
        </form>

        <div
          className="mp-reveal mx-auto mt-4 flex flex-wrap items-center justify-center gap-2"
          style={{ animationDelay: '220ms' }}
        >
          <span className="text-[12px]" style={{ color: MP.textSecondary, opacity: 0.75 }}>Popular:</span>
          {['Legon', 'KNUST', 'UCC', 'Cape Coast', 'Kumasi'].map((campus) => (
            <Link
              key={campus}
              href={`/hostels?q=${encodeURIComponent(campus)}`}
              className="rounded-full px-3 py-1 text-[12px] font-medium transition-colors hover:bg-[#2F7D57] hover:text-white"
              style={{ border: `1px solid ${MP.border}`, background: MP.surface, color: MP.greenDeep }}
            >
              {campus}
            </Link>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-5 pb-4 pt-10 sm:px-6">
        {featuredHostels.length > 0 ? (
          <div className="mx-auto grid max-w-4xl gap-4 text-left sm:grid-cols-3">
            {featuredHostels.slice(0, 3).map((h, i) => (
              <div key={h.slug} className="mp-reveal" style={{ animationDelay: `${280 + i * 70}ms` }}>
                <HostelCard hostel={h} />
              </div>
            ))}
          </div>
        ) : (
          <div
            className="mp-reveal mx-auto max-w-md rounded-2xl p-8 text-center"
            style={{ background: MP.surfaceSoft, border: `1px solid ${MP.border}`, animationDelay: '280ms' }}
          >
            <p className="text-sm font-medium" style={{ color: MP.ink }}>New listings are on the way</p>
            <p className="mt-1 text-[13px]" style={{ color: MP.textSecondary }}>
              Run a hostel near a campus? Be the first to list.
            </p>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-center text-[13px]" style={{ color: MP.textSecondary }}>
          <Link href="/hostels" className="font-medium hover:underline">Browse all hostels →</Link>
          <span aria-hidden="true">·</span>
          <Link href="/signup?plan=trial&source=directory" className="font-medium hover:underline">
            Run a hostel? List yours free →
          </Link>
        </div>
      </div>

      {/* ── TRUST STRIP — editorial 3-column, thin dividers ─────── */}
      <section className="mx-auto max-w-5xl px-5 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-xl text-center">
          <h2
            className="mp-reveal text-[26px] font-normal leading-tight tracking-[-0.02em] sm:text-[32px]"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif', color: MP.ink }}
          >
            Booking made honest
          </h2>
          <p className="mp-reveal mt-3 text-[14px] leading-relaxed sm:text-[15px]" style={{ color: MP.textSecondary, animationDelay: '60ms' }}>
            No agents, no inflated rates, no guesswork — just your campus hostel, direct.
          </p>
        </div>

        <div className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-6">
          {[
            { icon: HandCoins,   title: 'Book direct, no middleman', body: 'Pay your hostel, not an agent — no hidden commission baked into your rate.' },
            { icon: Zap,         title: 'Real-time availability',    body: 'Room counts come straight from each hostel’s own booking system.' },
            { icon: ShieldCheck, title: 'Run by real hostel owners', body: 'Every listing is managed by the hostel itself, not a reseller.' },
          ].map((item, i) => (
            <div
              key={item.title}
              className="mp-reveal px-1 text-center sm:border-l sm:px-6 sm:text-left first:sm:border-l-0"
              style={{ borderColor: MP.border, animationDelay: `${120 + i * 80}ms` }}
            >
              <item.icon className="mx-auto h-6 w-6 sm:mx-0" style={{ color: MP.goldDeep }} strokeWidth={1.5} />
              <p className="mt-4 text-[14px] font-semibold" style={{ color: MP.ink }}>{item.title}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: MP.textSecondary }}>{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <MarketplaceFooter />
    </div>
  )
}
