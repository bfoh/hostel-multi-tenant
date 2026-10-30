import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Image from 'next/image'
import Link from 'next/link'
import {
  BedDouble, Shield, Check, ArrowRight,
  Building2, CreditCard, Users, Globe, Gift,
  ChevronDown, BarChart3, Bot,
  PhoneCall, FileSpreadsheet, Wrench, ClipboardList, MapPin,
} from 'lucide-react'

import { PlatformFX } from '@/components/public/platform-fx'
import { PricingPlans, type Plan } from '@/components/public/pricing-plans'
import { MarketplaceNav } from '@/components/marketplace/marketplace-nav'
import { MarketplaceFooter } from '@/components/marketplace/marketplace-footer'
import { MP } from '@/lib/marketplace-theme'
import { BeddiloMark } from '@/components/brand/beddilo-logo'

/* ──────────────────────────────────────────────────────────────────────────────
   BEDDILO FOR OWNERS — Property management SaaS pitch for hostel and
   hotel owners/operators.
   Split out from the consumer-facing marketplace homepage (app/page.tsx) so
   guests land on a search-first experience and owners get a dedicated,
   linkable advertising page for the management system.
   Restrained Beddilo palette for a business audience: Deep Teal type and
   actions on Warm Ivory, Sunny Amber only as an accent.
   ────────────────────────────────────────────────────────────────────────── */

const SITE_URL = 'https://gh-hostels.com'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { absolute: 'Beddilo for Owners — Hostel & Hotel Management Software' },
  description:
    'The complete property management platform from Beddilo for hostels and hotels. Bookings, Paystack MoMo payments, GRA-compliant accounting, payroll, occupant portal — built for hostels in Accra, Kumasi, Cape Coast, Legon, KNUST, UCC and beyond.',
  keywords: [
    'hostel management software Ghana',
    'student hostel booking system',
    'hostel software Accra',
    'hostel booking Kumasi',
    'University of Ghana hostels',
    'KNUST hostels',
    'UCC hostels',
    'Paystack hostel payments',
    'MoMo hostel rent',
    'GRA tax hostel',
    'Ghana hostel SaaS',
    'student accommodation software Ghana',
    'hostel management West Africa',
  ],
  alternates: {
    canonical: `${SITE_URL}/for-owners`,
  },
  openGraph: {
    type: 'website',
    locale: 'en_GH',
    url: `${SITE_URL}/for-owners`,
    siteName: 'Beddilo',
    title: 'Beddilo for Owners — Smarter property management',
    description:
      'All-in-one hostel and hotel management. Bookings, MoMo payments, GRA-compliant accounting, payroll, occupant portal — one elegant platform.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Beddilo for Owners — Smarter property management',
    description:
      'Bookings, MoMo, GRA accounting, payroll — one platform for hostels and hotels.',
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

/* ── Design tokens — remapped to the shared light marketplace palette
   (lib/marketplace-theme.ts). Names kept as-is to minimize the diff across
   the rest of this file; FOREST_DEEP/IVORY/INK now mean "dark text",
   "dark text" (was light-on-dark, now dark-on-light), and "page background"
   (was dark ink, now light cream) respectively. ─────────────────────── */
const FOREST_DEEP = MP.ink
const FOREST_MID = MP.primary
const GOLD = MP.accent
const GOLD_SOFT = MP.accentSoft
const GOLD_DEEP = MP.accentText
const IVORY = MP.ink
const INK = MP.bg

const HAIR = MP.border
const HAIR_STRONG = MP.borderStrong

/* ── Content ──────────────────────────────────────────────────── */

type Feature = { icon: typeof BedDouble; title: string; desc: string; accent: string }

const HOSTEL_FEATURES: Feature[] = [
  {
    icon: BedDouble,
    title: 'Room & booking engine',
    desc: 'Gantt calendar, drag-to-extend stays, split payments, walk-in kiosk mode. From single rooms to 500-bed dormitories.',
    accent: MP.accentText,
  },
  {
    icon: CreditCard,
    title: 'MoMo & card payments',
    desc: 'Native Paystack integration. Accept MTN, Vodafone, AirtelTigo MoMo, cards, bank transfers — auto-reconciled to the ledger.',
    accent: MP.coralText,
  },
  {
    icon: BarChart3,
    title: 'GRA-compliant accounting',
    desc: 'Double-entry ledger, chart of accounts, trial balance, P&L, VAT/NHIL/GETFund support. Audit-ready from day one.',
    accent: MP.primary,
  },
  {
    icon: Users,
    title: 'Staff payroll & shifts',
    desc: 'QR clock-in, shift scheduling, SSNIT / PAYE / Tier-2 deductions, automated payslip generation. SSNIT-ready exports.',
    accent: MP.accentText,
  },
  {
    icon: Globe,
    title: 'Your brand, your domain',
    desc: 'Custom domain (app.yourhostel.com), your logo, your colours. Occupant and staff portals that feel like your own product.',
    accent: MP.coralText,
  },
  {
    icon: Bot,
    title: 'AI assistant in Twi & English',
    desc: '"How many rooms are free this weekend?" — Ask in plain English or Twi and get instant answers from your data.',
    accent: MP.primary,
  },
  {
    icon: Wrench,
    title: 'Maintenance & housekeeping',
    desc: 'Work orders, preventive schedules, meter readings, photo evidence, housekeeping task board — track every issue to close.',
    accent: MP.accentText,
  },
  {
    icon: ClipboardList,
    title: 'Occupant portal',
    desc: 'Residents see balance, upload deposit drafts, submit maintenance requests, view receipts. Less queue at the front desk.',
    accent: MP.coralText,
  },
  {
    icon: Shield,
    title: 'Row-level security',
    desc: 'Every tenant fully isolated at the database level. Encrypted HTTPS connections. Hosted on Supabase + Vercel.',
    accent: MP.primary,
  },
]

const HOTEL_FEATURES: Feature[] = [
  {
    icon: BedDouble,
    title: 'Reservations & front desk',
    desc: 'Calendar view, walk-in check-in, split payments, room holds. From boutique guesthouses to full-service hotels.',
    accent: MP.accentText,
  },
  {
    icon: CreditCard,
    title: 'MoMo & card payments',
    desc: 'Native Paystack integration. Accept MTN, Vodafone, AirtelTigo MoMo, cards, bank transfers — auto-reconciled to the ledger.',
    accent: MP.coralText,
  },
  {
    icon: BarChart3,
    title: 'GRA-compliant accounting',
    desc: 'Double-entry ledger, chart of accounts, trial balance, P&L, VAT/NHIL/GETFund support. Audit-ready from day one.',
    accent: MP.primary,
  },
  {
    icon: Users,
    title: 'Staff payroll & shifts',
    desc: 'QR clock-in, shift scheduling, SSNIT / PAYE / Tier-2 deductions, automated payslip generation. SSNIT-ready exports.',
    accent: MP.accentText,
  },
  {
    icon: Globe,
    title: 'Your brand, your domain',
    desc: 'Custom domain (app.yourhotel.com), your logo, your colours. Guest and staff portals that feel like your own product.',
    accent: MP.coralText,
  },
  {
    icon: Bot,
    title: 'AI assistant in Twi & English',
    desc: '"How many rooms are free this weekend?" — Ask in plain English or Twi and get instant answers from your data.',
    accent: MP.primary,
  },
  {
    icon: Wrench,
    title: 'Maintenance & housekeeping',
    desc: 'Work orders, preventive schedules, meter readings, photo evidence, housekeeping task board — track every issue to close.',
    accent: MP.accentText,
  },
  {
    icon: ClipboardList,
    title: 'Guest self-service portal',
    desc: 'Guests see their balance, view receipts, and submit requests from their phone. Less queue at the front desk.',
    accent: MP.coralText,
  },
  {
    icon: Shield,
    title: 'Row-level security',
    desc: 'Every tenant fully isolated at the database level. Encrypted HTTPS connections. Hosted on Supabase + Vercel.',
    accent: MP.primary,
  },
]

/**
 * Numbers here (price, features list) are duplicated from
 * lib/platform-plans.ts's PLAN_DEFS — pre-existing drift for the hostel
 * plans (not introduced here), extended the same way for hotel's. Hotel
 * prices are placeholders, approved 2026-09-25 pending real market data —
 * keep in sync with lib/platform-plans.ts if either changes.
 */
const HOSTEL_PLANS: Plan[] = [
  {
    name: 'Starter',
    slug: 'starter',
    price: '800',
    interval: '/month',
    desc: 'For hostels up to 50 rooms',
    features: [
      'Up to 50 rooms',
      'Online bookings + Paystack MoMo/card',
      'Invoices & digital receipts',
      'Occupant portal',
      'Email support',
    ],
    cta: 'Subscribe',
    highlight: false,
  },
  {
    name: 'Growth',
    slug: 'growth',
    price: '1,000',
    interval: '/month',
    desc: 'Unlimited rooms, payroll, multi-property',
    features: [
      'Unlimited rooms',
      'Staff payroll (SSNIT/PAYE)',
      'Full double-entry accounting',
      'Multi-property portfolio view',
      'Email support',
    ],
    cta: 'Subscribe',
    highlight: true,
  },
]

const HOTEL_PLANS: Plan[] = [
  {
    name: 'Hotel Starter',
    slug: 'hotel_starter',
    price: '1,200',
    interval: '/month',
    desc: 'For hotels up to 20 rooms',
    features: [
      'Up to 20 rooms',
      'Online bookings + Paystack MoMo/card',
      'Invoices & digital receipts',
      'Guest self-service portal',
      'Email support',
    ],
    cta: 'Subscribe',
    highlight: false,
  },
  {
    name: 'Hotel Growth',
    slug: 'hotel_growth',
    price: '1,600',
    interval: '/month',
    desc: 'Unlimited rooms, payroll, multi-property',
    features: [
      'Unlimited rooms',
      'Staff payroll (SSNIT/PAYE)',
      'Full double-entry accounting',
      'Multi-property portfolio view',
      'Email support',
    ],
    cta: 'Subscribe',
    highlight: true,
  },
]

type Faq = { q: string; a: string }

const HOSTEL_FAQS: Faq[] = [
  {
    q: 'How long is the free trial?',
    a: '30 days with full Growth plan features. No credit card required. Your data is preserved when you upgrade — nothing migrates or is lost.',
  },
  {
    q: 'Can I use my own domain like app.myhostel.com?',
    a: 'Yes. Add a custom domain in Settings and we issue SSL automatically. Occupants and staff log in via your subdomain, so the experience feels like your own product.',
  },
  {
    q: 'Do you support Mobile Money?',
    a: 'Yes — we integrate natively with Paystack to accept MTN MoMo, Vodafone Cash, AirtelTigo Money, Visa, Mastercard, and bank transfers. Payments are auto-reconciled to the accounting ledger and booking balance.',
  },
  {
    q: 'Is the accounting GRA-compliant?',
    a: 'Yes. Double-entry accounting with chart of accounts, VAT/NHIL/GETFund/COVID-19 levy support, and export-ready trial balance, P&L, and balance sheet — designed against the GRA filing checklist.',
  },
  {
    q: 'How is my data secured?',
    a: 'Each hostel is fully isolated using Postgres row-level security, data travels over encrypted HTTPS connections, and changes are recorded in an audit log. Hosted on Supabase + Vercel.',
  },
  {
    q: 'Can I manage multiple hostels?',
    a: 'The Growth plan includes a portfolio view that lets you manage multiple properties from a single dashboard — consolidated occupancy, revenue, and financials across every site.',
  },
  {
    q: 'Will it work in Accra, Kumasi, Cape Coast, Tamale?',
    a: 'Yes. Beddilo supports hostels across Ghana, with MoMo, GRA and SSNIT built in. Hostels around University of Ghana (Legon), KNUST, UCC, UEW, UDS, UMaT, Ashesi, GIMPA, Central University and private hostels nationwide are supported.',
  },
  {
    q: 'What happens when my trial ends?',
    a: "Your account switches to a limited mode: your public listing stays up, you can still view bookings and edit room prices, and everything else unlocks when you pick a plan. Your data isn't removed when the trial ends.",
  },
  {
    q: 'Can I import my existing data?',
    a: 'Yes. Beddilo has self-serve CSV import for rooms, occupants and bookings, so you can bring existing records across yourself and check a preview before anything is saved.',
  },
]

const HOTEL_FAQS: Faq[] = [
  {
    q: 'How long is the free trial?',
    a: '30 days with full Growth plan features. No credit card required. Your data is preserved when you upgrade — nothing migrates or is lost.',
  },
  {
    q: 'Can I use my own domain like app.myhotel.com?',
    a: 'Yes. Add a custom domain in Settings and we issue SSL automatically. Guests and staff log in via your subdomain, so the experience feels like your own product.',
  },
  {
    q: 'Do you support Mobile Money?',
    a: 'Yes — we integrate natively with Paystack to accept MTN MoMo, Vodafone Cash, AirtelTigo Money, Visa, Mastercard, and bank transfers. Payments are auto-reconciled to the accounting ledger and booking balance.',
  },
  {
    q: 'Is the accounting GRA-compliant?',
    a: 'Yes. Double-entry accounting with chart of accounts, VAT/NHIL/GETFund/COVID-19 levy support, and export-ready trial balance, P&L, and balance sheet — designed against the GRA filing checklist.',
  },
  {
    q: 'How is my data secured?',
    a: 'Each hotel is fully isolated using Postgres row-level security, data travels over encrypted HTTPS connections, and changes are recorded in an audit log. Hosted on Supabase + Vercel.',
  },
  {
    q: 'Can I manage multiple hotels?',
    a: 'The Growth plan includes a portfolio view that lets you manage multiple properties from a single dashboard — consolidated occupancy, revenue, and financials across every site.',
  },
  {
    q: 'Is this built for hotels, or adapted from a hostel product?',
    a: "It's the same platform as our hostel product, with hotel-appropriate defaults — nightly billing, guest terminology, no academic fields cluttering your guest records.",
  },
  {
    q: 'What happens when my trial ends?',
    a: "Your account switches to a limited mode: your public listing stays up, you can still view bookings and edit room prices, and everything else unlocks when you pick a plan. Your data isn't removed when the trial ends.",
  },
  {
    q: 'Can I import my existing data?',
    a: 'Yes. Beddilo has self-serve CSV import for rooms, guests and bookings, so you can bring existing records across yourself and check a preview before anything is saved.',
  },
]

const UNIVERSITIES = [
  'University of Ghana, Legon',
  'KNUST · Kumasi',
  'University of Cape Coast',
  'Ashesi University',
  'GIMPA',
  'Central University',
  'University for Development Studies',
  'University of Mines and Technology',
  'UEW · Winneba',
  'Pentecost University',
  'Wisconsin International',
  'Lancaster University Ghana',
]

const DESTINATIONS = [
  'Accra',
  'Kumasi',
  'Cape Coast',
  'Elmina',
  'Aburi',
  'Akosombo',
  'Ho · Volta Region',
  'Tamale',
  'Takoradi',
  'Koforidua',
  'Bolgatanga',
  'Kokrobite',
]

type CompareValue = boolean | 'manual' | 'partial'

const HOSTEL_COMPARISON: Array<{ label: string; spreadsheet: CompareValue; traditional: CompareValue; gh: CompareValue }> = [
  { label: 'Real-time occupancy view',  spreadsheet: false, traditional: false, gh: true },
  { label: 'MoMo & card payments',      spreadsheet: false, traditional: false, gh: true },
  { label: 'Auto-generated invoices',   spreadsheet: false, traditional: 'manual', gh: true },
  { label: 'GRA-compliant accounting',  spreadsheet: false, traditional: 'partial', gh: true },
  { label: 'Occupant self-service',     spreadsheet: false, traditional: false, gh: true },
  { label: 'Payroll w/ SSNIT/PAYE',     spreadsheet: 'manual', traditional: 'manual', gh: true },
  { label: 'Multi-property portfolio',  spreadsheet: false, traditional: false, gh: true },
  { label: 'Works on phone',            spreadsheet: false, traditional: false, gh: true },
]

const HOTEL_COMPARISON: Array<{ label: string; spreadsheet: CompareValue; traditional: CompareValue; gh: CompareValue }> = [
  { label: 'Real-time room availability', spreadsheet: false, traditional: false, gh: true },
  { label: 'MoMo & card payments',        spreadsheet: false, traditional: false, gh: true },
  { label: 'Auto-generated invoices',     spreadsheet: false, traditional: 'manual', gh: true },
  { label: 'GRA-compliant accounting',    spreadsheet: false, traditional: 'partial', gh: true },
  { label: 'Guest self-service',          spreadsheet: false, traditional: false, gh: true },
  { label: 'Payroll w/ SSNIT/PAYE',       spreadsheet: 'manual', traditional: 'manual', gh: true },
  { label: 'Multi-property portfolio',    spreadsheet: false, traditional: false, gh: true },
  { label: 'Works on phone',              spreadsheet: false, traditional: false, gh: true },
]

/* ── JSON-LD ──────────────────────────────────────────────────── */

const orgLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Beddilo',
  slogan: 'A world of stays',
  url: SITE_URL,
  logo: `${SITE_URL}/icons/icon-512.png`,
  description: 'Accommodation marketplace and property management software for hostels and hotels.',
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

const softwareLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Beddilo',
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: 'Property Management Software',
  operatingSystem: 'Web (Cloud)',
  url: SITE_URL,
  description:
    'All-in-one hostel and hotel management: bookings, MoMo payments, GRA accounting, payroll, guest and occupant portals.',
  offers: HOSTEL_PLANS.map((p) => ({
    '@type': 'Offer',
    name: `${p.name} plan`,
    price: p.price.replace(/,/g, ''),
    priceCurrency: 'GHS',
    description: p.desc,
  })),
}

const faqLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: HOSTEL_FAQS.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
}

/* ─────────────────────────────────────────────────────────────── */

export default async function ForOwnersPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const { type } = await searchParams
  const headerType = (await headers()).get('x-business-type')
  const isHotel = (type ?? headerType) === 'hotel'

  const nounSingular    = isHotel ? 'hotel'  : 'hostel'
  const nounPlural      = isHotel ? 'hotels' : 'hostels'
  const guestNoun       = isHotel ? 'guest'  : 'occupant'
  const signupHref      = `/signup?plan=trial${isHotel ? '&type=hotel' : ''}`

  const FEATURES    = isHotel ? HOTEL_FEATURES    : HOSTEL_FEATURES
  const PLANS       = isHotel ? HOTEL_PLANS       : HOSTEL_PLANS
  const FAQS        = isHotel ? HOTEL_FAQS        : HOSTEL_FAQS
  const COMPARISON  = isHotel ? HOTEL_COMPARISON  : HOSTEL_COMPARISON
  const MARQUEE     = isHotel ? DESTINATIONS      : UNIVERSITIES

  const heroWords = isHotel ? ['Every', 'room', 'booked.'] : ['Every', 'bed', 'booked.']

  return (
    <div
      className="relative min-h-screen antialiased"
      style={{ background: MP.bg }}
    >
      {/* Adinkra symbol collage — same fixed wallpaper texture as the
          marketplace homepage, for visual continuity between the two */}

      {/* Hydrate motion + glow + counters */}
      <PlatformFX />

      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

      <MarketplaceNav />

      {/* ── FOR HOSTEL OWNERS — management-system pitch ─────────── */}
      <section id="for-owners" className="relative overflow-hidden">
        {/* Animated mesh gradient backdrop */}
        <div className="pointer-events-none absolute inset-0 platform-mesh-light" aria-hidden="true" />

        {/* Floating ambient gold orb */}
        <div
          className="pointer-events-none absolute -right-32 top-32 h-[420px] w-[420px] rounded-full platform-float-slow"
          style={{ background: `radial-gradient(circle, ${GOLD}22, transparent 70%)`, filter: 'blur(40px)' }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -left-20 top-1/2 h-[360px] w-[360px] rounded-full platform-float"
          style={{ background: `radial-gradient(circle, ${MP.coral}24, transparent 65%)`, filter: 'blur(60px)' }}
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-20 text-center sm:px-6 sm:pb-28 md:pt-36">
          <p className="mb-5 text-[11px] font-medium uppercase tracking-[0.24em]" style={{ color: GOLD_DEEP }}>
            For {nounSingular} owners
          </p>

          {/* Announcement pill */}
          <div
            className="mx-auto mb-8 inline-flex items-center gap-2.5 rounded-full px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] sm:text-[12px]"
            style={{
              border: `1px solid ${HAIR_STRONG}`,
              background: MP.surfaceSoft,
              color: FOREST_MID,
            }}
            data-platform-reveal
          >
            <span className="relative inline-flex h-1.5 w-1.5">
              <span
                className="absolute inset-0 rounded-full platform-pulse-ring"
                style={{ color: GOLD_SOFT }}
              />
              <span className="relative h-1.5 w-1.5 rounded-full" style={{ background: GOLD_SOFT }} />
            </span>
            Bookings · Payments · Accounting<span className="hidden sm:inline"> · Payroll</span>
          </div>

          {/* Hero headline */}
          <h1
            className="mx-auto max-w-5xl font-display text-[40px] font-bold leading-[1.04] sm:text-[58px] md:text-[76px] lg:text-[92px]"
            style={{
              color: IVORY,
              letterSpacing: '-0.035em',
            }}
          >
            {heroWords.map((w, i) => (
              <span
                key={i}
                className="platform-word mr-3 inline-block"
                style={{ animationDelay: `${120 + i * 90}ms` }}
              >
                {w}
              </span>
            ))}
            <span
              className="platform-word block"
              style={{ animationDelay: `${120 + heroWords.length * 90}ms` }}
            >
              <span className="bg-[linear-gradient(transparent_62%,rgb(var(--bd-amber)/0.75)_62%,rgb(var(--bd-amber)/0.75)_92%,transparent_92%)] px-1">
                Every cedi tracked.
              </span>
            </span>
            <span
              className="platform-word mt-5 block text-[40%] font-semibold"
              style={{
                animationDelay: `${120 + (heroWords.length + 1) * 90}ms`,
                color: MP.textSecondary,
                letterSpacing: '-0.02em',
              }}
            >
              The operating system for your {nounSingular}.
            </span>
          </h1>

          <p
            className="mx-auto mt-8 max-w-[600px] text-[15px] leading-relaxed sm:mt-10 sm:text-[17px]"
            style={{ color: MP.textSecondary }}
            data-platform-reveal
            data-platform-reveal-delay="450"
          >
            One dashboard for bookings, Mobile Money, GRA-compliant accounting,
            SSNIT payroll and the {guestNoun} portal — built around how {nounPlural}{' '}
            in Ghana actually get paid, taxed and staffed.
          </p>

          {/* CTA buttons */}
          <div
            className="mt-11 flex flex-col items-center justify-center gap-4 sm:flex-row"
            data-platform-reveal
            data-platform-reveal-delay="600"
          >
            <Link
              href={signupHref}
              className="bd-focus group inline-flex w-full items-center justify-center gap-2 rounded-full bg-bd-teal px-8 py-4 text-[15px] font-semibold text-bd-ivory shadow-[0_14px_30px_-14px_rgba(11,31,35,0.6)] transition-colors hover:bg-bd-teal-900 sm:w-auto"
            >
              Start 30-day free trial
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#features"
              className="bd-focus inline-flex w-full items-center justify-center gap-2 rounded-full px-8 py-4 text-[15px] font-medium transition-colors duration-300 hover:bg-bd-teal/5 sm:w-auto"
              style={{ border: `1px solid ${HAIR_STRONG}`, color: IVORY }}
            >
              See how it works
            </a>
          </div>

          <p
            className="mt-5 text-[13px]"
            style={{ color: MP.textSecondary }}
            data-platform-reveal
            data-platform-reveal-delay="750"
          >
            No credit card · 30-day free trial · Cancel anytime
          </p>

          {/* Dashboard mockup */}
          <div
            className="relative mx-auto mt-14 max-w-5xl sm:mt-20 platform-mockup"
            data-platform-reveal
            data-platform-reveal-delay="500"
          >
            <div className="absolute inset-0 -z-10 translate-y-8">
              <div
                className="mx-auto h-full w-full max-w-4xl rounded-3xl blur-[100px]"
                style={{
                  background: `linear-gradient(to bottom, ${GOLD}22, ${FOREST_MID}11, transparent)`,
                }}
              />
            </div>
            <div
              className="overflow-hidden rounded-2xl shadow-2xl"
              style={{
                border: `1px solid ${HAIR_STRONG}`,
                boxShadow: '0 40px 80px -30px rgba(23,59,66,0.18), 0 20px 40px -15px rgba(42,90,97,0.12)',
              }}
            >
              <div
                className="flex items-center gap-2 px-4 py-3"
                style={{ borderBottom: `1px solid ${HAIR}`, background: 'rgba(23,59,66,0.04)' }}
              >
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ background: 'rgba(23,59,66,0.12)' }} />
                  <div className="h-2.5 w-2.5 rounded-full" style={{ background: 'rgba(23,59,66,0.12)' }} />
                  <div className="h-2.5 w-2.5 rounded-full" style={{ background: 'rgba(23,59,66,0.12)' }} />
                </div>
                <div
                  className="ml-4 flex-1 rounded-md py-1 px-3 text-center text-[10px]"
                  style={{ background: 'rgba(23,59,66,0.04)', color: MP.textSecondary }}
                >
                  {isHotel ? 'app.yourhotel.com/dashboard' : 'app.yourhostel.com/dashboard'}
                </div>
              </div>
              <Image
                src="/owner-dashboard.jpg"
                alt="Beddilo owner dashboard showing occupancy, monthly revenue, pending bookings and recent bookings, with sample data"
                width={1920}
                height={1200}
                className="h-auto w-full"
                priority
                sizes="(max-width: 1024px) 100vw, 1024px"
              />
            </div>
            <div
              className="absolute bottom-0 left-0 right-0 h-44"
              style={{ background: `linear-gradient(to top, ${INK} 5%, transparent 100%)` }}
            />
          </div>
        </div>
      </section>

      {/* ── MARQUEE — institutions for hostels, destinations for hotels ── */}
      <section className="py-14 sm:py-18" style={{ borderBottom: `1px solid ${HAIR}` }}>
        <p
          className="mb-7 text-center text-[11px] font-medium uppercase tracking-[0.24em]"
          style={{ color: MP.textSecondary }}
        >
          {isHotel ? 'Built for hotels across these destinations' : 'Built for hostels near campuses like these'}
        </p>
        <div className="platform-marquee-mask overflow-hidden">
          <div className="platform-marquee">
            {[...MARQUEE, ...MARQUEE].map((u, i) => {
              const MarqueeIcon = isHotel ? MapPin : Building2
              return (
                <span
                  key={`${u}-${i}`}
                  className="mx-6 inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-[14px] font-medium sm:text-[15px]"
                  style={{ color: MP.textSecondary }}
                >
                  <MarqueeIcon className="h-3.5 w-3.5" style={{ color: GOLD }} />
                  {u}
                  <span className="ml-6 inline-block h-1 w-1 rounded-full" style={{ background: GOLD_DEEP }} />
                </span>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────────── */}
      <section id="features" className="py-20 sm:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center" data-platform-reveal>
            <p className="text-[11px] font-medium uppercase tracking-[0.24em]" style={{ color: GOLD_DEEP }}>
              Features
            </p>
            <h2
              className="mt-5 text-[32px] font-display font-bold leading-[1.1] tracking-[-0.03em] sm:text-[42px] md:text-[64px]"
              style={{ color: IVORY }}
            >
              Everything your {nounSingular} needs,
              <span className="block" style={{ color: MP.textSecondary }}>
                elegantly unified.
              </span>
            </h2>
            <p
              className="mx-auto mt-6 max-w-[460px] text-[14px] sm:text-[16px]"
              style={{ color: MP.textSecondary }}
            >
              One login. No spreadsheets. No third-party patchwork. Just a system that works, with Ghana&apos;s payment rails and tax rules built in.
            </p>
          </div>

          <div className="mt-14 grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => {
              const Icon = f.icon
              return (
                <div
                  key={f.title}
                  className="platform-glow-card group relative rounded-2xl p-6 sm:p-7"
                  style={{
                    border: `1px solid ${HAIR_STRONG}`,
                    background:
                      'linear-gradient(180deg, rgba(23,59,66,0.025) 0%, rgba(23,59,66,0.005) 100%)',
                  }}
                  data-platform-reveal
                  data-platform-reveal-delay={String(i * 60)}
                >
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3"
                    style={{
                      background: `linear-gradient(135deg, ${f.accent}22, ${f.accent}08)`,
                      border: `1px solid ${f.accent}33`,
                    }}
                  >
                    <Icon className="h-5 w-5" style={{ color: f.accent }} strokeWidth={1.5} />
                  </div>
                  <h3
                    className="mt-6 text-[16px] font-semibold tracking-tight sm:text-[17px]"
                    style={{ color: IVORY, }}
                  >
                    {f.title}
                  </h3>
                  <p
                    className="mt-2.5 text-[14px] leading-relaxed"
                    style={{ color: MP.textSecondary }}
                  >
                    {f.desc}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── COMPARISON ──────────────────────────────────────────── */}
      <section className="py-20 sm:py-28" style={{ borderTop: `1px solid ${HAIR}` }}>
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center" data-platform-reveal>
            <p className="text-[11px] font-medium uppercase tracking-[0.24em]" style={{ color: GOLD_DEEP }}>
              Why switch
            </p>
            <h2
              className="mt-5 text-[32px] font-display font-bold leading-[1.1] tracking-[-0.03em] sm:text-[42px] md:text-[58px]"
              style={{ color: IVORY }}
            >
              Stop bleeding hours.
              <span className="block" style={{ color: MP.textSecondary }}>
                Spreadsheets weren&apos;t built for {nounPlural}.
              </span>
            </h2>
          </div>

          <div
            className="bd-focus-on-dark mt-14 -mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0"
            data-platform-reveal
            tabIndex={0}
            role="region"
            aria-label="Comparison with spreadsheets"
          >
          <div
            className="min-w-[560px] overflow-hidden rounded-2xl"
            style={{ border: `1px solid ${HAIR_STRONG}` }}
          >
            <div
              className="grid grid-cols-[1.6fr_1fr_1fr_1fr] items-center gap-1 px-5 py-4 text-[12px] font-medium uppercase tracking-[0.14em]"
              style={{
                background: 'rgba(23,59,66,0.04)',
                color: MP.textSecondary,
                borderBottom: `1px solid ${HAIR}`,
              }}
            >
              <div className="text-left">Capability</div>
              <div className="text-center inline-flex items-center justify-center gap-1.5">
                <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
              </div>
              <div className="text-center inline-flex items-center justify-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" /> Legacy
              </div>
              <div className="text-center inline-flex items-center justify-center gap-1.5" style={{ color: GOLD_DEEP }}>
                <BeddiloMark className="h-4 w-4" title="" />
                Beddilo
              </div>
            </div>

            {COMPARISON.map((row, i) => (
              <div
                key={row.label}
                className="grid grid-cols-[1.6fr_1fr_1fr_1fr] items-center gap-1 px-5 py-3.5 text-[14px]"
                style={{
                  background: i % 2 ? 'rgba(23,59,66,0.015)' : 'transparent',
                  color: IVORY,
                  borderBottom: i === COMPARISON.length - 1 ? 'none' : `1px solid ${HAIR}`,
                }}
              >
                <div style={{ color: 'rgba(23,59,66,0.78)' }}>{row.label}</div>
                <ComparisonCell value={row.spreadsheet} />
                <ComparisonCell value={row.traditional} />
                <ComparisonCell value={row.gh} highlight />
              </div>
            ))}
          </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ─────────────────────────────────────────────── */}
      <section id="pricing" className="py-20 sm:py-28" style={{ borderTop: `1px solid ${HAIR}` }}>
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center" data-platform-reveal>
            <p className="text-[11px] font-medium uppercase tracking-[0.24em]" style={{ color: GOLD_DEEP }}>
              Pricing
            </p>
            <h2
              className="mt-5 text-[32px] font-display font-bold leading-[1.1] tracking-[-0.03em] sm:text-[42px] md:text-[58px]"
              style={{ color: IVORY }}
            >
              Simple, transparent, in cedis.
            </h2>
            <p
              className="mx-auto mt-5 max-w-[440px] text-[14px] sm:text-[16px]"
              style={{ color: MP.textSecondary }}
            >
              Start free. Pick a plan when you&apos;re ready. No hidden charges, no per-occupant fees.
            </p>
          </div>

          <PricingPlans plans={PLANS} isHotel={isHotel} />

          <div
            className="mx-auto mt-12 flex max-w-2xl flex-col items-center justify-between gap-4 rounded-2xl p-6 sm:flex-row"
            style={{ border: `1px solid ${HAIR_STRONG}`, background: MP.surface }}
            data-platform-reveal
          >
            <div className="flex items-center gap-3">
              <Gift className="h-5 w-5" style={{ color: GOLD }} />
              <div>
                <p className="text-[14px] font-semibold" style={{ color: IVORY }}>
                  Not ready to commit?
                </p>
                <p className="text-[13px]" style={{ color: MP.textSecondary }}>
                  Start a 30-day free trial. All Growth features, no card required.
                </p>
              </div>
            </div>
            <Link
              href={signupHref}
              className="bd-focus w-full shrink-0 rounded-full bg-bd-teal px-5 py-2.5 text-center text-[14px] font-semibold text-bd-ivory transition-colors hover:bg-bd-teal-900 sm:w-auto"
            >
              Start free trial <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────── */}
      <section id="faq" className="py-20 sm:py-28" style={{ borderTop: `1px solid ${HAIR}` }}>
        <div className="mx-auto max-w-3xl px-6">
          <div className="text-center" data-platform-reveal>
            <p className="text-[11px] font-medium uppercase tracking-[0.24em]" style={{ color: GOLD_DEEP }}>
              FAQ
            </p>
            <h2
              className="mt-5 text-[32px] font-display font-bold leading-[1.1] tracking-[-0.03em] sm:text-[40px] md:text-[52px]"
              style={{ color: IVORY }}
            >
              Questions, answered.
            </h2>
          </div>

          <div className="mt-12 divide-y" style={{ borderColor: HAIR }}>
            {FAQS.map((faq, i) => (
              <details
                key={faq.q}
                className="group py-5"
                style={{ borderColor: HAIR }}
                data-platform-reveal
                data-platform-reveal-delay={String(i * 30)}
              >
                <summary
                  className="flex cursor-pointer items-center justify-between text-[15px] font-medium transition-colors duration-300 hover:opacity-90 [&::-webkit-details-marker]:hidden"
                  style={{ color: IVORY }}
                >
                  {faq.q}
                  <ChevronDown
                    className="h-4 w-4 shrink-0 transition-transform duration-300 group-open:rotate-180"
                    style={{ color: MP.primary }}
                  />
                </summary>
                <p
                  className="platform-acc-body mt-3 pr-8 text-[14.5px] leading-relaxed"
                  style={{ color: MP.textSecondary }}
                >
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA — Deep Teal band, the one place the amber shimmer
           headline and amber CTA sit on a dark ground ─────────────── */}
      <section className="relative overflow-hidden bg-bd-teal py-20 text-bd-ivory sm:py-28">
        <div
          className="pointer-events-none absolute inset-0 platform-mesh opacity-70"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <BeddiloMark
            tone="ivory"
            title=""
            className="mx-auto h-14 w-14 platform-float"
          />
          <h2
            className="mt-8 font-display text-[36px] font-bold leading-[1.05] tracking-[-0.03em] text-bd-ivory sm:text-[48px] md:text-[64px]"
            data-platform-reveal
            data-platform-reveal-delay="100"
          >
            Run your {nounSingular}
            <span className="block platform-shimmer-text">like it&apos;s 2026.</span>
          </h2>
          <p
            className="mx-auto mt-6 max-w-[460px] text-[16px] leading-relaxed text-bd-ivory/80"
            data-platform-reveal
            data-platform-reveal-delay="200"
          >
            Start with a 30-day free trial of every Growth feature. No credit card required.
          </p>
          <div
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
            data-platform-reveal
            data-platform-reveal-delay="300"
          >
            <Link
              href={signupHref}
              data-platform-magnetic
              className="platform-cta bd-focus-on-dark inline-flex w-full items-center justify-center gap-2 rounded-full bg-bd-amber px-8 py-4 text-[15px] font-semibold text-bd-teal sm:w-auto"
            >
              Start 30-day free trial <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="mailto:sales@gh-hostels.com"
              className="bd-focus-on-dark inline-flex w-full items-center justify-center gap-2 rounded-full border border-bd-ivory/30 px-8 py-4 text-[15px] font-medium text-bd-ivory transition-colors duration-300 hover:bg-bd-ivory/10 sm:w-auto"
            >
              <PhoneCall className="h-4 w-4" /> Talk to sales
            </a>
          </div>
        </div>
      </section>

      <MarketplaceFooter />
    </div>
  )
}

/* ── Helpers ──────────────────────────────────────────────────── */

function ComparisonCell({
  value,
  highlight,
}: {
  value: boolean | 'manual' | 'partial'
  highlight?: boolean
}) {
  if (value === true) {
    return (
      <div className="text-center">
        <Check
          className="mx-auto h-4 w-4"
          style={{ color: highlight ? MP.primary : MP.textSecondary }}
          strokeWidth={3}
        />
      </div>
    )
  }
  if (value === 'manual') {
    return (
      <div className="text-center text-[12px] uppercase tracking-[0.12em]" style={{ color: MP.textSecondary }}>
        Manual
      </div>
    )
  }
  if (value === 'partial') {
    return (
      <div className="text-center text-[12px] uppercase tracking-[0.12em]" style={{ color: MP.textSecondary }}>
        Partial
      </div>
    )
  }
  return (
    <div className="text-center text-[18px]" style={{ color: MP.textSecondary }}>
      —
    </div>
  )
}
