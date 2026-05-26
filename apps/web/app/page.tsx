import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import {
  BedDouble, Shield, Check, ArrowRight,
  Building2, CreditCard, FileText, Users, Globe, Sparkles,
  ChevronDown, BarChart3, Bot, ChevronRight, MapPin, Star,
  PhoneCall, Smartphone, Lock, FileSpreadsheet, Wrench, ClipboardList,
} from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { AuthErrorRedirect } from '@/components/auth/auth-error-redirect'
import { PlatformFX } from '@/components/public/platform-fx'

/* ──────────────────────────────────────────────────────────────────────────────
   GH HOSTELS — Premium Ghanaian SaaS landing
   Forest green · Warm gold · Ivory · Adinkra-inspired motion
   ────────────────────────────────────────────────────────────────────────── */

const SITE_URL = 'https://gh-hostels.com'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'GH Hostels — Hostel Management Software for Ghana & West Africa',
  description:
    'The complete hostel management platform for Ghanaian student hostels. Bookings, Paystack MoMo payments, GRA-compliant accounting, payroll, occupant portal — built for hostels in Accra, Kumasi, Cape Coast, Legon, KNUST, UCC and beyond.',
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
    canonical: SITE_URL,
  },
  // openGraph + twitter images auto-injected by app/opengraph-image.tsx and app/twitter-image.tsx
  openGraph: {
    type: 'website',
    locale: 'en_GH',
    url: SITE_URL,
    siteName: 'GH Hostels',
    title: 'GH Hostels — Smarter hostel management for Ghana',
    description:
      'All-in-one hostel management built in Ghana, for Ghana. Bookings, MoMo payments, GRA-compliant accounting, payroll, occupant portal — one elegant platform.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GH Hostels — Smarter hostel management for Ghana',
    description:
      'Bookings, MoMo, GRA accounting, payroll — one platform built for Ghanaian hostels.',
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

/* ── Content ──────────────────────────────────────────────────── */

const FEATURES = [
  {
    icon: BedDouble,
    title: 'Room & booking engine',
    desc: 'Gantt calendar, drag-to-extend stays, split payments, walk-in kiosk mode. From single rooms to 500-bed dormitories.',
    accent: GOLD,
  },
  {
    icon: CreditCard,
    title: 'MoMo & card payments',
    desc: 'Native Paystack integration. Accept MTN, Vodafone, AirtelTigo MoMo, cards, bank transfers — auto-reconciled to the ledger.',
    accent: GOLD_SOFT,
  },
  {
    icon: BarChart3,
    title: 'GRA-compliant accounting',
    desc: 'Double-entry ledger, chart of accounts, trial balance, P&L, VAT/NHIL/GETFund support. Audit-ready from day one.',
    accent: FOREST_MID,
  },
  {
    icon: Users,
    title: 'Staff payroll & shifts',
    desc: 'QR clock-in, shift scheduling, SSNIT / PAYE / Tier-2 deductions, automated payslip generation. SSNIT-ready exports.',
    accent: GOLD,
  },
  {
    icon: Globe,
    title: 'Your brand, your domain',
    desc: 'Custom domain (app.yourhostel.com), your logo, your colours. Occupant and staff portals that feel like your own product.',
    accent: GOLD_SOFT,
  },
  {
    icon: Bot,
    title: 'AI assistant in Twi & English',
    desc: '"How many rooms are free this weekend?" — Ask in plain English or Twi and get instant answers from your data.',
    accent: FOREST_MID,
  },
  {
    icon: Wrench,
    title: 'Maintenance & housekeeping',
    desc: 'Work orders, preventive schedules, meter readings, photo evidence, housekeeping task board — track every issue to close.',
    accent: GOLD,
  },
  {
    icon: ClipboardList,
    title: 'Occupant portal',
    desc: 'Residents see balance, upload deposit drafts, submit maintenance requests, view receipts. Less queue at the front desk.',
    accent: GOLD_SOFT,
  },
  {
    icon: Shield,
    title: 'Row-level security',
    desc: 'Every tenant fully isolated at the database level. Encryption at rest & in transit. Hosted on Supabase + Vercel.',
    accent: FOREST_MID,
  },
]

const PLANS = [
  {
    name: 'Starter',
    price: '500',
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
    price: '800',
    interval: '/month',
    desc: 'For hostels up to 200 rooms',
    features: [
      'Up to 200 rooms',
      'Staff payroll (SSNIT/PAYE)',
      'Full double-entry accounting',
      'Multi-property portfolio view',
      'WhatsApp + priority support',
    ],
    cta: 'Subscribe',
    highlight: true,
  },
  {
    name: 'Pro',
    price: '1,000',
    interval: '/month',
    desc: 'Unlimited rooms, AI, SLA',
    features: [
      'Unlimited rooms',
      'AI booking agent (Twi + English)',
      'Custom domain + branding',
      'Anomaly & fraud detection',
      'Dedicated SLA + onboarding',
    ],
    cta: 'Subscribe',
    highlight: false,
  },
]

const FAQS = [
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
    a: 'All data is encrypted at rest and in transit. Each hostel is fully isolated using Postgres row-level security. Hosted on Supabase + Vercel with daily backups and audit logging.',
  },
  {
    q: 'Can I manage multiple hostels?',
    a: 'The Growth and Pro plans include a portfolio view that lets you manage multiple properties from a single dashboard — consolidated occupancy, revenue, and financials across every site.',
  },
  {
    q: 'Will it work in Accra, Kumasi, Cape Coast, Tamale?',
    a: 'Yes. GH Hostels is built in Ghana, for Ghana. Hostels around University of Ghana (Legon), KNUST, UCC, UEW, UDS, UMaT, Ashesi, GIMPA, Central University and private hostels nationwide are supported.',
  },
  {
    q: 'What happens when my trial ends?',
    a: "Your account stays accessible and your data is preserved. You just pick a plan to continue. We will never delete your data without your explicit consent.",
  },
  {
    q: 'Do you offer onboarding help?',
    a: 'Yes. Growth and Pro customers get a guided onboarding call. Pro customers get a dedicated success manager and SLA. We help you import existing room and occupant data.',
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

const LOCATIONS = [
  { city: 'Accra', hostels: 142, label: 'Legon, East Legon, Madina, Adenta' },
  { city: 'Kumasi', hostels: 96, label: 'KNUST campus, Ayeduase, Bomso, Kentinkrono' },
  { city: 'Cape Coast', hostels: 41, label: 'UCC, Apewosika, Amamoma' },
  { city: 'Tamale', hostels: 28, label: 'UDS, Kalpohini, Vittin' },
  { city: 'Winneba', hostels: 22, label: 'UEW, North campus, Central campus' },
  { city: 'Ho', hostels: 14, label: 'UHAS, HTU, central Ho' },
]

type CompareValue = boolean | 'manual' | 'partial'

const COMPARISON: Array<{ label: string; spreadsheet: CompareValue; traditional: CompareValue; gh: CompareValue }> = [
  { label: 'Real-time occupancy view',  spreadsheet: false, traditional: false, gh: true },
  { label: 'MoMo & card payments',      spreadsheet: false, traditional: false, gh: true },
  { label: 'Auto-generated invoices',   spreadsheet: false, traditional: 'manual', gh: true },
  { label: 'GRA-compliant accounting',  spreadsheet: false, traditional: 'partial', gh: true },
  { label: 'Occupant self-service',     spreadsheet: false, traditional: false, gh: true },
  { label: 'Payroll w/ SSNIT/PAYE',     spreadsheet: 'manual', traditional: 'manual', gh: true },
  { label: 'Multi-property portfolio',  spreadsheet: false, traditional: false, gh: true },
  { label: 'Daily off-site backups',    spreadsheet: false, traditional: false, gh: true },
  { label: 'Works on phone',            spreadsheet: false, traditional: false, gh: true },
]

const TESTIMONIALS = [
  {
    quote: 'Switched from Excel and the front desk queue disappeared overnight. Residents check their balance on their phones now.',
    name: 'Akua Boateng',
    role: 'Manager, hostel near KNUST',
    rating: 5,
  },
  {
    quote: 'The MoMo reconciliation alone saves my accountant a full day every week. The GRA filing is no longer a nightmare.',
    name: 'Kwame Asare',
    role: 'Owner, Legon hostel portfolio',
    rating: 5,
  },
  {
    quote: 'We onboarded 320 residents in three days. The occupant portal made check-in feel like a real product.',
    name: 'Linda Mensah',
    role: 'GM, Cape Coast hostel',
    rating: 5,
  },
]

/* ── JSON-LD ──────────────────────────────────────────────────── */

const orgLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'GH Hostels',
  url: SITE_URL,
  logo: `${SITE_URL}/icons/icon.svg`,
  description: 'Modern hostel management software for Ghana and West Africa.',
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
  name: 'GH Hostels',
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: 'Hostel Management Software',
  operatingSystem: 'Web (Cloud)',
  url: SITE_URL,
  description:
    'All-in-one hostel management: bookings, MoMo payments, GRA accounting, payroll, occupant portal.',
  offers: PLANS.map((p) => ({
    '@type': 'Offer',
    name: `${p.name} plan`,
    price: p.price.replace(/,/g, ''),
    priceCurrency: 'GHS',
    description: p.desc,
  })),
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.9',
    reviewCount: '127',
    bestRating: '5',
  },
}

const faqLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
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

  const heroWords = ['Hostel', 'management,']

  return (
    <div
      className="min-h-screen text-[#f5e9d2] selection:bg-[#D4A24C]/40 selection:text-white antialiased"
      style={{ background: INK }}
    >
      {/* Hydrate motion + glow + counters */}
      <PlatformFX />

      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

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
            {['Features', 'Locations', 'Pricing', 'FAQ'].map((l) => (
              <a
                key={l}
                href={`#${l.toLowerCase()}`}
                className="text-[13px] font-medium tracking-[0.08em] uppercase text-[#a8a89e] transition-colors duration-300 hover:text-[#F5E9D2]"
              >
                {l}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-[13px] font-medium text-[#a8a89e] transition-colors hover:text-[#F5E9D2]"
            >
              Log in
            </Link>
            <Link
              href="/signup?plan=trial"
              className="platform-cta hidden rounded-full px-4 py-2 text-[13px] font-semibold sm:inline-flex"
              style={{
                background: `linear-gradient(135deg, ${GOLD_SOFT} 0%, ${GOLD} 60%, ${GOLD_DEEP} 100%)`,
                color: FOREST_DEEP,
                boxShadow: '0 6px 20px -8px rgba(212,162,76,0.55)',
              }}
            >
              Start free trial
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Animated mesh gradient backdrop */}
        <div className="pointer-events-none absolute inset-0 platform-mesh" aria-hidden="true" />

        {/* Floating ambient gold orb */}
        <div
          className="pointer-events-none absolute -right-32 top-32 h-[420px] w-[420px] rounded-full platform-float-slow"
          style={{ background: `radial-gradient(circle, ${GOLD}22, transparent 70%)`, filter: 'blur(40px)' }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -left-20 top-1/2 h-[360px] w-[360px] rounded-full platform-float"
          style={{ background: `radial-gradient(circle, ${FOREST_MID}33, transparent 65%)`, filter: 'blur(60px)' }}
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-20 text-center sm:px-6 sm:pb-28 md:pt-36">
          {/* Announcement pill */}
          <div
            className="mx-auto mb-8 inline-flex items-center gap-2.5 rounded-full px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] sm:text-[12px]"
            style={{
              border: `1px solid ${HAIR_STRONG}`,
              background: 'rgba(15, 76, 58, 0.35)',
              color: IVORY,
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
            Built in Ghana · Trusted across West Africa
            <ChevronRight className="h-3 w-3" />
          </div>

          {/* Hero headline */}
          <h1
            className="mx-auto max-w-5xl text-[40px] font-normal leading-[1.04] tracking-[-1.2px] sm:text-[58px] md:text-[80px] lg:text-[104px]"
            style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              color: IVORY,
              letterSpacing: '-0.04em',
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
              className="platform-word inline-block platform-shimmer-text"
              style={{ animationDelay: `${120 + heroWords.length * 90}ms` }}
            >
              made in Ghana.
            </span>
            <span
              className="platform-word mt-3 block text-[68%] italic"
              style={{
                animationDelay: `${120 + (heroWords.length + 1) * 90}ms`,
                color: 'rgba(245, 233, 210, 0.5)',
                fontFamily: 'Georgia, serif',
              }}
            >
              For the way we run hostels here.
            </span>
          </h1>

          <p
            className="mx-auto mt-7 max-w-[580px] text-[15px] leading-relaxed sm:mt-9 sm:text-[17px]"
            style={{ color: 'rgba(245, 233, 210, 0.62)' }}
            data-platform-reveal
            data-platform-reveal-delay="450"
          >
            Bookings, MoMo payments, GRA-compliant accounting, SSNIT payroll, occupant portal —
            one calm dashboard, built for hostels across Ghana and West Africa.
          </p>

          {/* CTA buttons */}
          <div
            className="mt-11 flex flex-col items-center justify-center gap-4 sm:flex-row"
            data-platform-reveal
            data-platform-reveal-delay="600"
          >
            <Link
              href="/signup?plan=trial"
              data-platform-magnetic
              className="platform-cta group inline-flex w-full items-center justify-center gap-2 rounded-full px-8 py-4 text-[14px] font-semibold sm:w-auto"
              style={{
                background: `linear-gradient(135deg, ${GOLD_SOFT} 0%, ${GOLD} 50%, ${GOLD_DEEP} 100%)`,
                color: FOREST_DEEP,
                boxShadow: '0 12px 32px -10px rgba(212,162,76,0.55)',
              }}
            >
              Start 30-day free trial
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#features"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full px-8 py-4 text-[14px] font-medium transition-colors duration-300 hover:bg-[#F5E9D2]/10 sm:w-auto"
              style={{ border: `1px solid ${HAIR_STRONG}`, color: IVORY }}
            >
              See how it works
            </a>
          </div>

          <p
            className="mt-5 text-[12px]"
            style={{ color: 'rgba(245, 233, 210, 0.38)' }}
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
                boxShadow: '0 60px 120px -40px rgba(0,0,0,0.6), 0 30px 60px -20px rgba(15,76,58,0.4)',
              }}
            >
              <div
                className="flex items-center gap-2 px-4 py-3"
                style={{ borderBottom: `1px solid ${HAIR}`, background: 'rgba(245,233,210,0.04)' }}
              >
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ background: 'rgba(245,233,210,0.12)' }} />
                  <div className="h-2.5 w-2.5 rounded-full" style={{ background: 'rgba(245,233,210,0.12)' }} />
                  <div className="h-2.5 w-2.5 rounded-full" style={{ background: 'rgba(245,233,210,0.12)' }} />
                </div>
                <div
                  className="ml-4 flex-1 rounded-md py-1 px-3 text-center text-[10px]"
                  style={{ background: 'rgba(245,233,210,0.04)', color: 'rgba(245,233,210,0.45)' }}
                >
                  app.abremponghostel.com/dashboard
                </div>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/dashboard-hero.jpg"
                alt="GH Hostels dashboard preview"
                className="w-full"
                loading="eager"
              />
            </div>
            <div
              className="absolute bottom-0 left-0 right-0 h-44"
              style={{ background: `linear-gradient(to top, ${INK} 5%, transparent 100%)` }}
            />
          </div>
        </div>
      </section>

      {/* ── TRUST BAR with animated counters ────────────────────── */}
      <section
        style={{
          borderTop: `1px solid ${HAIR}`,
          borderBottom: `1px solid ${HAIR}`,
          background: 'rgba(15, 76, 58, 0.12)',
        }}
      >
        <div
          className="mx-auto grid max-w-6xl grid-cols-2 divide-y md:grid-cols-4 md:divide-x md:divide-y-0"
          style={{ borderColor: HAIR }}
        >
          {[
            { value: 500, prefix: '', suffix: '+', label: 'Hostels managed' },
            { value: 2,   prefix: 'GH₵ ', suffix: 'M+', label: 'Processed monthly' },
            { value: 99.9, prefix: '', suffix: '%', decimals: 1, label: 'Uptime guarantee' },
            { value: 16, prefix: '', suffix: ' regions', label: 'Across Ghana' },
          ].map((s, i) => (
            <div
              key={s.label}
              className="px-4 py-7 text-center sm:px-6 sm:py-10"
              style={{ borderColor: HAIR }}
              data-platform-reveal
              data-platform-reveal-delay={String(i * 80)}
            >
              <p
                className="platform-counter text-[26px] font-semibold tracking-tight sm:text-[36px]"
                style={{ color: IVORY, fontFamily: 'Plus Jakarta Sans, Inter, sans-serif' }}
                data-platform-counter={s.value}
                data-platform-prefix={s.prefix}
                data-platform-suffix={s.suffix}
                data-platform-decimals={String(s.decimals ?? 0)}
              >
                {s.prefix}0{s.suffix}
              </p>
              <p
                className="mt-2 text-[11px] uppercase tracking-[0.16em] sm:text-[12px]"
                style={{ color: 'rgba(245,233,210,0.5)' }}
              >
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── UNIVERSITY MARQUEE ──────────────────────────────────── */}
      <section className="py-14 sm:py-18" style={{ borderBottom: `1px solid ${HAIR}` }}>
        <p
          className="mb-7 text-center text-[11px] font-medium uppercase tracking-[0.24em]"
          style={{ color: 'rgba(245,233,210,0.45)' }}
        >
          Powering hostels serving these institutions
        </p>
        <div className="platform-marquee-mask overflow-hidden">
          <div className="platform-marquee">
            {[...UNIVERSITIES, ...UNIVERSITIES].map((u, i) => (
              <span
                key={`${u}-${i}`}
                className="mx-6 inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-[14px] font-medium sm:text-[15px]"
                style={{ color: 'rgba(245,233,210,0.62)' }}
              >
                <Building2 className="h-3.5 w-3.5" style={{ color: GOLD }} />
                {u}
                <span className="ml-6 inline-block h-1 w-1 rounded-full" style={{ background: GOLD_DEEP }} />
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────────── */}
      <section id="features" className="py-20 sm:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center" data-platform-reveal>
            <p className="text-[11px] font-medium uppercase tracking-[0.24em]" style={{ color: GOLD }}>
              Features
            </p>
            <h2
              className="mt-5 text-[32px] font-normal leading-[1.1] tracking-[-0.04em] sm:text-[42px] md:text-[64px]"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif', color: IVORY }}
            >
              Everything your hostel needs,
              <span className="block italic" style={{ color: 'rgba(245,233,210,0.55)' }}>
                elegantly unified.
              </span>
            </h2>
            <p
              className="mx-auto mt-6 max-w-[460px] text-[14px] sm:text-[16px]"
              style={{ color: 'rgba(245,233,210,0.55)' }}
            >
              One login. No spreadsheets. No third-party patchwork. Just a system that works — built in Ghana, for Ghana.
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
                      'linear-gradient(180deg, rgba(245,233,210,0.025) 0%, rgba(245,233,210,0.005) 100%)',
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
                    style={{ color: IVORY, fontFamily: 'Plus Jakarta Sans, Inter, sans-serif' }}
                  >
                    {f.title}
                  </h3>
                  <p
                    className="mt-2.5 text-[14px] leading-relaxed"
                    style={{ color: 'rgba(245,233,210,0.58)' }}
                  >
                    {f.desc}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── BUILT FOR GHANA — locations ─────────────────────────── */}
      <section
        id="locations"
        className="relative py-20 sm:py-28"
        style={{
          borderTop: `1px solid ${HAIR}`,
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(15,76,58,0.35) 0%, transparent 60%)',
        }}
      >
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center" data-platform-reveal>
            <p className="text-[11px] font-medium uppercase tracking-[0.24em]" style={{ color: GOLD }}>
              Built for Ghana
            </p>
            <h2
              className="mt-5 text-[32px] font-normal leading-[1.1] tracking-[-0.04em] sm:text-[42px] md:text-[58px]"
              style={{ fontFamily: 'Georgia, serif', color: IVORY }}
            >
              From Accra to Tamale.
              <span className="block italic" style={{ color: 'rgba(245,233,210,0.55)' }}>
                Wherever students live, we run it.
              </span>
            </h2>
          </div>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {LOCATIONS.map((loc, i) => (
              <div
                key={loc.city}
                className="platform-glow-card rounded-2xl p-6"
                style={{
                  border: `1px solid ${HAIR_STRONG}`,
                  background:
                    'linear-gradient(180deg, rgba(15,76,58,0.18) 0%, rgba(15,76,58,0.04) 100%)',
                }}
                data-platform-reveal
                data-platform-reveal-delay={String(i * 70)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <MapPin className="h-4 w-4" style={{ color: GOLD }} strokeWidth={2} />
                    <h3
                      className="text-[17px] font-semibold tracking-tight"
                      style={{ color: IVORY, fontFamily: 'Plus Jakarta Sans, Inter, sans-serif' }}
                    >
                      {loc.city}
                    </h3>
                  </div>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums"
                    style={{
                      background: `${GOLD}18`,
                      color: GOLD_SOFT,
                      border: `1px solid ${GOLD}33`,
                    }}
                  >
                    {loc.hostels}+ hostels
                  </span>
                </div>
                <p className="mt-3 text-[13.5px] leading-relaxed" style={{ color: 'rgba(245,233,210,0.55)' }}>
                  {loc.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPARISON ──────────────────────────────────────────── */}
      <section className="py-20 sm:py-28" style={{ borderTop: `1px solid ${HAIR}` }}>
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center" data-platform-reveal>
            <p className="text-[11px] font-medium uppercase tracking-[0.24em]" style={{ color: GOLD }}>
              Why switch
            </p>
            <h2
              className="mt-5 text-[32px] font-normal leading-[1.1] tracking-[-0.04em] sm:text-[42px] md:text-[58px]"
              style={{ fontFamily: 'Georgia, serif', color: IVORY }}
            >
              Stop bleeding hours.
              <span className="block italic" style={{ color: 'rgba(245,233,210,0.55)' }}>
                Spreadsheets weren&apos;t built for hostels.
              </span>
            </h2>
          </div>

          <div
            className="mt-14 overflow-hidden rounded-2xl"
            style={{ border: `1px solid ${HAIR_STRONG}` }}
            data-platform-reveal
          >
            <div
              className="grid grid-cols-[1.6fr_1fr_1fr_1fr] items-center gap-1 px-5 py-4 text-[12px] font-medium uppercase tracking-[0.14em]"
              style={{
                background: 'rgba(245,233,210,0.04)',
                color: 'rgba(245,233,210,0.55)',
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
              <div className="text-center inline-flex items-center justify-center gap-1.5" style={{ color: GOLD }}>
                <Image src="/logo-mark.svg" alt="" width={14} height={14} className="h-3.5 w-3.5" />
                GH Hostels
              </div>
            </div>

            {COMPARISON.map((row, i) => (
              <div
                key={row.label}
                className="grid grid-cols-[1.6fr_1fr_1fr_1fr] items-center gap-1 px-5 py-3.5 text-[14px]"
                style={{
                  background: i % 2 ? 'rgba(245,233,210,0.015)' : 'transparent',
                  color: IVORY,
                  borderBottom: i === COMPARISON.length - 1 ? 'none' : `1px solid ${HAIR}`,
                }}
              >
                <div style={{ color: 'rgba(245,233,210,0.78)' }}>{row.label}</div>
                <ComparisonCell value={row.spreadsheet} />
                <ComparisonCell value={row.traditional} />
                <ComparisonCell value={row.gh} highlight />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ────────────────────────────────────────── */}
      <section
        className="py-20 sm:py-28"
        style={{ borderTop: `1px solid ${HAIR}`, background: 'rgba(15,76,58,0.10)' }}
      >
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center" data-platform-reveal>
            <p className="text-[11px] font-medium uppercase tracking-[0.24em]" style={{ color: GOLD }}>
              Loved by hostel owners
            </p>
            <h2
              className="mt-5 text-[32px] font-normal leading-[1.1] tracking-[-0.04em] sm:text-[42px] md:text-[58px]"
              style={{ fontFamily: 'Georgia, serif', color: IVORY }}
            >
              The team that
              <span className="italic" style={{ color: 'rgba(245,233,210,0.55)' }}> sleeps at night.</span>
            </h2>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <figure
                key={i}
                className="platform-glow-card flex flex-col rounded-2xl p-7"
                style={{
                  border: `1px solid ${HAIR_STRONG}`,
                  background:
                    'linear-gradient(180deg, rgba(245,233,210,0.03) 0%, rgba(245,233,210,0.005) 100%)',
                }}
                data-platform-reveal
                data-platform-reveal-delay={String(i * 80)}
              >
                <div className="flex gap-0.5">
                  {Array.from({ length: t.rating }).map((_, idx) => (
                    <Star key={idx} className="h-4 w-4 fill-current" style={{ color: GOLD }} />
                  ))}
                </div>
                <blockquote
                  className="mt-5 flex-1 text-[15px] leading-relaxed"
                  style={{ color: 'rgba(245,233,210,0.85)' }}
                >
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3 pt-5" style={{ borderTop: `1px solid ${HAIR}` }}>
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-semibold"
                    style={{ background: `${GOLD}22`, color: GOLD_SOFT, border: `1px solid ${GOLD}33` }}
                  >
                    {t.name.split(' ').map((n) => n[0]).join('')}
                  </div>
                  <div>
                    <p className="text-[13.5px] font-semibold" style={{ color: IVORY }}>
                      {t.name}
                    </p>
                    <p className="text-[12px]" style={{ color: 'rgba(245,233,210,0.5)' }}>
                      {t.role}
                    </p>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ─────────────────────────────────────────────── */}
      <section id="pricing" className="py-20 sm:py-28" style={{ borderTop: `1px solid ${HAIR}` }}>
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center" data-platform-reveal>
            <p className="text-[11px] font-medium uppercase tracking-[0.24em]" style={{ color: GOLD }}>
              Pricing
            </p>
            <h2
              className="mt-5 text-[32px] font-normal leading-[1.1] tracking-[-0.04em] sm:text-[42px] md:text-[58px]"
              style={{ fontFamily: 'Georgia, serif', color: IVORY }}
            >
              Simple, transparent, in cedis.
            </h2>
            <p
              className="mx-auto mt-5 max-w-[440px] text-[14px] sm:text-[16px]"
              style={{ color: 'rgba(245,233,210,0.55)' }}
            >
              Start free. Pick a plan when you&apos;re ready. No hidden charges, no per-occupant fees.
            </p>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {PLANS.map((plan, i) => (
              <div
                key={plan.name}
                className={`platform-glow-card relative flex flex-col rounded-2xl p-7`}
                style={{
                  border: `1px solid ${plan.highlight ? GOLD : HAIR_STRONG}`,
                  background: plan.highlight
                    ? `linear-gradient(180deg, rgba(212,162,76,0.10) 0%, rgba(212,162,76,0.02) 100%)`
                    : 'linear-gradient(180deg, rgba(245,233,210,0.025) 0%, rgba(245,233,210,0.005) 100%)',
                  boxShadow: plan.highlight ? `0 30px 60px -30px ${GOLD}55` : undefined,
                }}
                data-platform-reveal
                data-platform-reveal-delay={String(i * 80)}
              >
                {plan.highlight && (
                  <span
                    className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em]"
                    style={{
                      background: `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD_DEEP})`,
                      color: FOREST_DEEP,
                    }}
                  >
                    Most popular
                  </span>
                )}
                <p className="text-[14px] font-semibold tracking-tight" style={{ color: IVORY }}>
                  {plan.name}
                </p>
                <p className="mt-1.5 text-[13px]" style={{ color: 'rgba(245,233,210,0.45)' }}>
                  {plan.desc}
                </p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-[13px]" style={{ color: 'rgba(245,233,210,0.45)' }}>GH₵</span>
                  <span
                    className="text-[40px] font-bold tracking-tight tabular-nums sm:text-[48px]"
                    style={{ color: IVORY, fontFamily: 'Plus Jakarta Sans, Inter, sans-serif' }}
                  >
                    {plan.price}
                  </span>
                  <span className="text-[14px]" style={{ color: 'rgba(245,233,210,0.45)' }}>
                    {plan.interval}
                  </span>
                </div>
                <ul className="mt-7 flex-1 space-y-3.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[14px]" style={{ color: 'rgba(245,233,210,0.78)' }}>
                      <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: GOLD }} strokeWidth={2.5} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/signup?plan=${plan.name.toLowerCase()}`}
                  className={`platform-cta mt-8 block rounded-full py-3.5 text-center text-[14px] font-semibold transition-all`}
                  style={
                    plan.highlight
                      ? {
                          background: `linear-gradient(135deg, ${GOLD_SOFT} 0%, ${GOLD} 50%, ${GOLD_DEEP} 100%)`,
                          color: FOREST_DEEP,
                          boxShadow: '0 10px 28px -10px rgba(212,162,76,0.55)',
                        }
                      : {
                          border: `1px solid ${HAIR_STRONG}`,
                          color: IVORY,
                        }
                  }
                >
                  {plan.cta} <ArrowRight className="ml-1.5 inline h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </div>

          <div
            className="mx-auto mt-12 flex max-w-2xl flex-col items-center justify-between gap-4 rounded-2xl p-6 sm:flex-row"
            style={{ border: `1px solid ${HAIR_STRONG}`, background: 'rgba(15,76,58,0.20)' }}
            data-platform-reveal
          >
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5" style={{ color: GOLD }} />
              <div>
                <p className="text-[14px] font-semibold" style={{ color: IVORY }}>
                  Not ready to commit?
                </p>
                <p className="text-[13px]" style={{ color: 'rgba(245,233,210,0.5)' }}>
                  Start a 30-day free trial. All Growth features, no card required.
                </p>
              </div>
            </div>
            <Link
              href="/signup?plan=trial"
              className="platform-cta w-full shrink-0 rounded-full px-5 py-2.5 text-center text-[13px] font-semibold sm:w-auto"
              style={{
                background: `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD_DEEP})`,
                color: FOREST_DEEP,
              }}
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
            <p className="text-[11px] font-medium uppercase tracking-[0.24em]" style={{ color: GOLD }}>
              FAQ
            </p>
            <h2
              className="mt-5 text-[32px] font-normal leading-[1.1] tracking-[-0.04em] sm:text-[40px] md:text-[52px]"
              style={{ fontFamily: 'Georgia, serif', color: IVORY }}
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
                    style={{ color: GOLD }}
                  />
                </summary>
                <p
                  className="platform-acc-body mt-3 pr-8 text-[14.5px] leading-relaxed"
                  style={{ color: 'rgba(245,233,210,0.62)' }}
                >
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden py-20 sm:py-32"
        style={{
          borderTop: `1px solid ${HAIR}`,
          background:
            'radial-gradient(ellipse at 50% 50%, rgba(15,76,58,0.55) 0%, transparent 70%)',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 platform-mesh opacity-60"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <Image
            src="/logo-mark.svg"
            alt=""
            width={56}
            height={56}
            className="mx-auto h-14 w-14 platform-float"
            data-platform-reveal
          />
          <h2
            className="mt-8 text-[36px] font-normal leading-[1.05] tracking-[-0.04em] sm:text-[48px] md:text-[72px]"
            style={{ fontFamily: 'Georgia, serif', color: IVORY }}
            data-platform-reveal
            data-platform-reveal-delay="100"
          >
            Run your hostel
            <span className="block italic platform-shimmer-text">like it&apos;s 2026.</span>
          </h2>
          <p
            className="mx-auto mt-6 max-w-[440px] text-[15px]"
            style={{ color: 'rgba(245,233,210,0.6)' }}
            data-platform-reveal
            data-platform-reveal-delay="200"
          >
            Join hundreds of Ghanaian hostel owners who&apos;ve already switched.
            Set-up takes one afternoon.
          </p>
          <div
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
            data-platform-reveal
            data-platform-reveal-delay="300"
          >
            <Link
              href="/signup?plan=trial"
              data-platform-magnetic
              className="platform-cta inline-flex w-full items-center justify-center gap-2 rounded-full px-8 py-4 text-[14px] font-semibold sm:w-auto"
              style={{
                background: `linear-gradient(135deg, ${GOLD_SOFT} 0%, ${GOLD} 50%, ${GOLD_DEEP} 100%)`,
                color: FOREST_DEEP,
                boxShadow: '0 18px 42px -12px rgba(212,162,76,0.6)',
              }}
            >
              Start 30-day free trial <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="mailto:sales@gh-hostels.com"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full px-8 py-4 text-[14px] font-medium transition-colors duration-300 hover:bg-[#F5E9D2]/10 sm:w-auto"
              style={{ border: `1px solid ${HAIR_STRONG}`, color: IVORY }}
            >
              <PhoneCall className="h-4 w-4" /> Talk to sales
            </a>
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
                Modern hostel management software, built in Ghana, for Ghanaian hostels and West Africa.
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em]" style={{ color: GOLD }}>
                Product
              </p>
              <ul className="mt-4 space-y-2.5 text-[13px]" style={{ color: 'rgba(245,233,210,0.6)' }}>
                <li><a href="#features" className="transition-colors hover:text-[#F5E9D2]">Features</a></li>
                <li><a href="#pricing" className="transition-colors hover:text-[#F5E9D2]">Pricing</a></li>
                <li><a href="#faq" className="transition-colors hover:text-[#F5E9D2]">FAQ</a></li>
                <li><Link href="/compare/cloudbeds" className="transition-colors hover:text-[#F5E9D2]">vs Cloudbeds</Link></li>
                <li><Link href="/compare/spreadsheet" className="transition-colors hover:text-[#F5E9D2]">vs Spreadsheet</Link></li>
                <li><Link href="/signup?plan=trial" className="transition-colors hover:text-[#F5E9D2]">Start trial</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em]" style={{ color: GOLD }}>
                Company
              </p>
              <ul className="mt-4 space-y-2.5 text-[13px]" style={{ color: 'rgba(245,233,210,0.6)' }}>
                <li><a href="mailto:hello@gh-hostels.com" className="transition-colors hover:text-[#F5E9D2]">Contact</a></li>
                <li><a href="mailto:sales@gh-hostels.com" className="transition-colors hover:text-[#F5E9D2]">Sales</a></li>
                <li><a href="mailto:support@gh-hostels.com" className="transition-colors hover:text-[#F5E9D2]">Support</a></li>
                <li><Link href="/login" className="transition-colors hover:text-[#F5E9D2]">Log in</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em]" style={{ color: GOLD }}>
                Trust
              </p>
              <ul className="mt-4 space-y-2.5 text-[13px]" style={{ color: 'rgba(245,233,210,0.6)' }}>
                <li className="inline-flex items-center gap-2"><Lock className="h-3.5 w-3.5" style={{ color: GOLD }} /> Encrypted at rest</li>
                <li className="inline-flex items-center gap-2"><Shield className="h-3.5 w-3.5" style={{ color: GOLD }} /> Row-level isolation</li>
                <li className="inline-flex items-center gap-2"><Smartphone className="h-3.5 w-3.5" style={{ color: GOLD }} /> Paystack MoMo + card</li>
                <li className="inline-flex items-center gap-2"><FileText className="h-3.5 w-3.5" style={{ color: GOLD }} /> GRA-ready accounting</li>
              </ul>
            </div>
          </div>

          <div
            className="mt-10 flex flex-col items-center justify-between gap-4 pt-6 sm:flex-row"
            style={{ borderTop: `1px solid ${HAIR}` }}
          >
            <p className="text-[12px]" style={{ color: 'rgba(245,233,210,0.4)' }}>
              © {new Date().getFullYear()} GH Hostels. Made in Accra, Ghana. 🇬🇭
            </p>
            <div className="flex gap-6 text-[12px]" style={{ color: 'rgba(245,233,210,0.4)' }}>
              <a href="#" className="transition-colors hover:text-[#F5E9D2]">Privacy</a>
              <a href="#" className="transition-colors hover:text-[#F5E9D2]">Terms</a>
              <a href="mailto:support@gh-hostels.com" className="transition-colors hover:text-[#F5E9D2]">Support</a>
            </div>
          </div>
        </div>
      </footer>
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
          style={{ color: highlight ? GOLD : 'rgba(245,233,210,0.5)' }}
          strokeWidth={3}
        />
      </div>
    )
  }
  if (value === 'manual') {
    return (
      <div className="text-center text-[12px] uppercase tracking-[0.12em]" style={{ color: 'rgba(245,233,210,0.42)' }}>
        Manual
      </div>
    )
  }
  if (value === 'partial') {
    return (
      <div className="text-center text-[12px] uppercase tracking-[0.12em]" style={{ color: 'rgba(245,233,210,0.42)' }}>
        Partial
      </div>
    )
  }
  return (
    <div className="text-center text-[18px]" style={{ color: 'rgba(245,233,210,0.22)' }}>
      —
    </div>
  )
}
