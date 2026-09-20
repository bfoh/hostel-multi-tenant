import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { MapPin, Lock, Search } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { AuthErrorRedirect } from '@/components/auth/auth-error-redirect'
import { PlatformFX } from '@/components/public/platform-fx'
import { MobileNav } from '@/components/public/mobile-nav'
import { searchHostels } from '@/lib/directory'
import { formatGHS } from '@/lib/utils'

/* ──────────────────────────────────────────────────────────────────────────────
   GH HOSTELS — Premium Ghanaian SaaS landing
   Forest green · Warm gold · Ivory · Adinkra-inspired motion
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
  // openGraph + twitter images auto-injected by app/opengraph-image.tsx and app/twitter-image.tsx
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

/* ── Design tokens (Ghanaian palette) ─────────────────────────── */
const FOREST_DEEP = '#0A3729'
const FOREST_MID = '#1B6E54'
const GOLD = '#D4A24C'
const GOLD_SOFT = '#F5C26B'
const GOLD_DEEP = '#B8842E'
const IVORY = '#F5E9D2'
const INK = '#0A0A08'

const HAIR = 'rgba(245, 233, 210, 0.10)'
const HAIR_STRONG = 'rgba(245, 233, 210, 0.18)'

/* ── JSON-LD ──────────────────────────────────────────────────── */

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

/* ─────────────────────────────────────────────────────────────── */

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const headersList = await headers()
  const host = headersList.get('host') ?? ''
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'gh-hostels.com'
  const rootDomain = appDomain.startsWith('app.') ? appDomain.slice(4) : appDomain
  const isAppDomain = host === rootDomain || host === `app.${rootDomain}` || host === `www.${rootDomain}` || host.includes('localhost')

  if (user && isAppDomain) redirect('/dashboard')

  const heroWords = ['Every', 'bed', 'booked.']
  const { hostels: featuredHostels, total: totalListed } = await searchHostels({ limit: 6 })

  return (
    <div
      className="min-h-screen text-[#f5e9d2] selection:bg-[#D4A24C]/40 selection:text-white antialiased"
      style={{ background: INK }}
    >
      {/* Adinkra symbol collage — fixed so the texture reads as one
          continuous wallpaper behind the whole page, not per-section tiles */}
      <div className="pointer-events-none fixed inset-0 -z-10 platform-adinkra-bg" aria-hidden="true" />

      {/* Hydrate motion + glow + counters */}
      <PlatformFX />

      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }} />

      <AuthErrorRedirect />

      {/* ── NAV ────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-50 backdrop-blur-2xl"
        style={{
          background: 'rgba(10,10,8,0.72)',
          borderBottom: `1px solid ${HAIR}`,
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <Link href="/" className="group flex items-center gap-2.5">
            <Image
              src="/logo-mark.svg"
              alt="GH Hostels"
              width={36}
              height={36}
              className="h-9 w-9 transition-transform duration-500 group-hover:rotate-[6deg]"
              priority
            />
            <span
              className="text-[15px] font-bold tracking-[0.16em]"
              style={{ fontFamily: 'Plus Jakarta Sans, Inter, sans-serif', color: IVORY }}
            >
              GH-HOSTELS
            </span>
          </Link>

          <div className="hidden items-center gap-9 md:flex">
            <Link
              href="/hostels"
              className="text-[13px] font-medium tracking-[0.08em] uppercase text-[#a8a89e] transition-colors duration-300 hover:text-[#F5E9D2]"
            >
              Find a Hostel
            </Link>
            <Link
              href="/for-owners"
              className="text-[13px] font-medium tracking-[0.08em] uppercase text-[#a8a89e] transition-colors duration-300 hover:text-[#F5E9D2]"
            >
              For Hostel Owners
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden text-[13px] font-medium text-[#a8a89e] transition-colors hover:text-[#F5E9D2] md:inline-flex"
            >
              Log in
            </Link>
            <Link
              href="/signup?plan=trial"
              className="platform-cta hidden rounded-full px-4 py-2 text-[13px] font-semibold md:inline-flex"
              style={{
                background: `linear-gradient(135deg, ${GOLD_SOFT} 0%, ${GOLD} 60%, ${GOLD_DEEP} 100%)`,
                color: FOREST_DEEP,
                boxShadow: '0 6px 20px -8px rgba(212,162,76,0.55)',
              }}
            >
              List your hostel free
            </Link>

            {/* Mobile hamburger + slide-down menu */}
            <MobileNav />
          </div>
        </div>
      </nav>

      {/* ── MARKETPLACE HERO — Booking.com-style search, the primary
           front door for students/guests ────────────────────────── */}
      <section className="relative overflow-hidden" style={{ borderBottom: `1px solid ${HAIR}` }}>
        <div className="pointer-events-none absolute inset-0 platform-mesh" aria-hidden="true" />
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-[380px] w-[380px] rounded-full platform-float-slow"
          style={{ background: `radial-gradient(circle, ${GOLD}1c, transparent 70%)`, filter: 'blur(50px)' }}
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-5xl px-5 pb-16 pt-16 text-center sm:px-6 sm:pb-24 sm:pt-24">
          <div
            className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em]"
            style={{ border: `1px solid ${HAIR_STRONG}`, background: 'rgba(15,76,58,0.35)', color: IVORY }}
          >
            <span className="relative h-1.5 w-1.5 rounded-full" style={{ background: GOLD_SOFT }} />
            {totalListed} hostels listed across Ghana
          </div>

          <h1
            className="mx-auto max-w-3xl text-[36px] font-normal leading-[1.08] tracking-[-0.03em] sm:text-[52px] md:text-[64px]"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif', color: IVORY }}
          >
            Find your next hostel.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed sm:text-[17px]" style={{ color: 'rgba(245,233,210,0.65)' }}>
            Search real-time availability near your campus, book directly, no middleman.
          </p>

          <form
            action="/hostels"
            method="get"
            className="mx-auto mt-9 flex max-w-2xl flex-col gap-2 rounded-2xl p-2.5 sm:flex-row sm:items-center"
            style={{ border: `1px solid ${HAIR_STRONG}`, background: 'rgba(245,233,210,0.04)' }}
          >
            <div className="flex flex-1 items-center gap-2 rounded-xl px-4 py-3" style={{ background: 'rgba(245,233,210,0.05)' }}>
              <Search className="h-4 w-4 shrink-0" style={{ color: GOLD }} />
              <input
                name="q"
                placeholder="Hostel name or campus — Legon, KNUST, UCC…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-[rgba(245,233,210,0.35)]"
                style={{ color: IVORY }}
              />
            </div>
            <div className="flex items-center gap-2 rounded-xl px-4 py-3 sm:w-44" style={{ background: 'rgba(245,233,210,0.05)' }}>
              <MapPin className="h-4 w-4 shrink-0" style={{ color: GOLD }} />
              <input
                name="city"
                placeholder="City"
                className="w-full bg-transparent text-sm outline-none placeholder:text-[rgba(245,233,210,0.35)]"
                style={{ color: IVORY }}
              />
            </div>
            <button
              type="submit"
              className="shrink-0 rounded-xl px-6 py-3 text-sm font-semibold"
              style={{ background: `linear-gradient(135deg, ${GOLD_SOFT} 0%, ${GOLD} 60%, ${GOLD_DEEP} 100%)`, color: FOREST_DEEP }}
            >
              Search
            </button>
          </form>

          {featuredHostels.length > 0 && (
            <div className="mx-auto mt-14 grid max-w-4xl gap-4 text-left sm:grid-cols-3">
              {featuredHostels.slice(0, 3).map((h, i) => (
                <Link
                  key={h.slug}
                  href={`/hostels/${h.slug}`}
                  className="platform-glow-card rounded-2xl p-5"
                  style={{
                    border: `1px solid ${HAIR_STRONG}`,
                    background: 'linear-gradient(180deg, rgba(15,76,58,0.18) 0%, rgba(15,76,58,0.04) 100%)',
                  }}
                  data-platform-reveal
                  data-platform-reveal-delay={String(i * 70)}
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} />
                    <h3 className="truncate text-[14px] font-semibold" style={{ color: IVORY }}>{h.name}</h3>
                  </div>
                  <p className="mt-2 text-[12.5px]" style={{ color: 'rgba(245,233,210,0.5)' }}>
                    {[h.address_city, h.address_region].filter(Boolean).join(', ') || 'Ghana'}
                  </p>
                  <p className="mt-2 text-[13px] font-semibold" style={{ color: GOLD_SOFT }}>
                    From {formatGHS(h.from_rate)}
                  </p>
                </Link>
              ))}
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px]" style={{ color: 'rgba(245,233,210,0.5)' }}>
            <Link href="/hostels" className="font-medium hover:text-[#F5E9D2] transition-colors">Browse all hostels →</Link>
            <span aria-hidden="true">·</span>
            <Link href="/signup?plan=trial&source=directory" className="font-medium hover:text-[#F5E9D2] transition-colors">
              Run a hostel? List yours free →
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────── */}
      <footer className="relative" style={{ borderTop: `1px solid ${HAIR}` }}>
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-10 md:grid-cols-4">
            <div>
              <Link href="/" className="flex items-center gap-2.5">
                <Image src="/logo-mark.svg" alt="GH-HOSTELS" width={32} height={32} className="h-8 w-8" />
                <span
                  className="text-[13px] font-bold tracking-[0.16em]"
                  style={{ color: IVORY, fontFamily: 'Plus Jakarta Sans, Inter, sans-serif' }}
                >
                  GH-HOSTELS
                </span>
              </Link>
              <p className="mt-4 text-[13px] leading-relaxed" style={{ color: 'rgba(245,233,210,0.45)' }}>
                Find and book student hostels across Ghana — real-time availability, no middleman.
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em]" style={{ color: GOLD }}>
                Find a Hostel
              </p>
              <ul className="mt-4 space-y-2.5 text-[13px]" style={{ color: 'rgba(245,233,210,0.6)' }}>
                <li><Link href="/hostels" className="transition-colors hover:text-[#F5E9D2]">Browse all hostels</Link></li>
                <li><Link href="/hostels?region=Greater%20Accra" className="transition-colors hover:text-[#F5E9D2]">Hostels in Accra</Link></li>
                <li><Link href="/hostels?region=Ashanti" className="transition-colors hover:text-[#F5E9D2]">Hostels in Kumasi</Link></li>
                <li><Link href="/hostels?region=Central" className="transition-colors hover:text-[#F5E9D2]">Hostels in Cape Coast</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em]" style={{ color: GOLD }}>
                For Hostel Owners
              </p>
              <ul className="mt-4 space-y-2.5 text-[13px]" style={{ color: 'rgba(245,233,210,0.6)' }}>
                <li><Link href="/for-owners" className="transition-colors hover:text-[#F5E9D2]">Management system</Link></li>
                <li><Link href="/for-owners#pricing" className="transition-colors hover:text-[#F5E9D2]">Pricing</Link></li>
                <li><Link href="/for-owners#faq" className="transition-colors hover:text-[#F5E9D2]">FAQ</Link></li>
                <li><Link href="/signup?plan=trial&source=directory" className="transition-colors hover:text-[#F5E9D2]">List your hostel free</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em]" style={{ color: GOLD }}>
                Company
              </p>
              <ul className="mt-4 space-y-2.5 text-[13px]" style={{ color: 'rgba(245,233,210,0.6)' }}>
                <li><a href="mailto:hello@gh-hostels.com" className="transition-colors hover:text-[#F5E9D2]">Contact</a></li>
                <li><a href="mailto:support@gh-hostels.com" className="transition-colors hover:text-[#F5E9D2]">Support</a></li>
                <li><Link href="/login" className="transition-colors hover:text-[#F5E9D2]">Log in</Link></li>
                <li className="inline-flex items-center gap-2 pt-1" style={{ color: 'rgba(245,233,210,0.45)' }}>
                  <Lock className="h-3.5 w-3.5" style={{ color: GOLD }} /> Encrypted &amp; secure
                </li>
              </ul>
            </div>
          </div>

          <div
            className="mt-10 flex flex-col items-center justify-between gap-4 pt-6 sm:flex-row"
            style={{ borderTop: `1px solid ${HAIR}` }}
          >
            <p className="text-[12px]" style={{ color: 'rgba(245,233,210,0.4)' }}>
              © {new Date().getFullYear()} GH Hostels · Made in Accra, Ghana
            </p>
            <div className="flex gap-6 text-[12px]" style={{ color: 'rgba(245,233,210,0.4)' }}>
              <Link href="/privacy" className="transition-colors hover:text-[#F5E9D2]">Privacy</Link>
              <Link href="/terms" className="transition-colors hover:text-[#F5E9D2]">Terms</Link>
              <a href="mailto:support@gh-hostels.com" className="transition-colors hover:text-[#F5E9D2]">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

