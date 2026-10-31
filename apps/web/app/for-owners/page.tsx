import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Image from 'next/image'
import Link from 'next/link'
import {
  BedDouble, Shield, Check, ArrowRight, Minus,
  CreditCard, Users, Globe,
  ChevronDown, BarChart3, Bot,
  Wrench, ClipboardList,
} from 'lucide-react'

import { PricingPlans, type Plan } from '@/components/public/pricing-plans'
import { MarketplaceNav } from '@/components/marketplace/marketplace-nav'
import { MarketplaceFooter } from '@/components/marketplace/marketplace-footer'

/* ──────────────────────────────────────────────────────────────────────────────
   BEDDILO FOR OWNERS — Property management SaaS pitch for hostel and
   hotel owners/operators.
   Split out from the consumer-facing marketplace homepage (app/page.tsx) so
   guests land on a search-first experience and owners get a dedicated,
   linkable advertising page for the management system.
   Same look as the marketplace: white pages, near-black type, teal only
   for actions, and the real owner dashboard instead of illustrations.
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


/* ── Content ──────────────────────────────────────────────────── */

type Feature = { icon: typeof BedDouble; title: string; desc: string }

const HOSTEL_FEATURES: Feature[] = [
  {
    icon: BedDouble,
    title: 'Room & booking engine',
    desc: 'Gantt calendar, drag-to-extend stays, split payments, walk-in kiosk mode. From single rooms to 500-bed dormitories.',
  },
  {
    icon: CreditCard,
    title: 'MoMo & card payments',
    desc: 'Native Paystack integration. Accept MTN, Vodafone, AirtelTigo MoMo, cards, bank transfers — auto-reconciled to the ledger.',
  },
  {
    icon: BarChart3,
    title: 'GRA-compliant accounting',
    desc: 'Double-entry ledger, chart of accounts, trial balance, P&L, VAT/NHIL/GETFund support. Audit-ready from day one.',
  },
  {
    icon: Users,
    title: 'Staff payroll & shifts',
    desc: 'QR clock-in, shift scheduling, SSNIT / PAYE / Tier-2 deductions, automated payslip generation. SSNIT-ready exports.',
  },
  {
    icon: Globe,
    title: 'Your brand, your domain',
    desc: 'Custom domain (app.yourhostel.com), your logo, your colours. Occupant and staff portals that feel like your own product.',
  },
  {
    icon: Bot,
    title: 'AI assistant in Twi & English',
    desc: '"How many rooms are free this weekend?" — Ask in plain English or Twi and get instant answers from your data.',
  },
  {
    icon: Wrench,
    title: 'Maintenance & housekeeping',
    desc: 'Work orders, preventive schedules, meter readings, photo evidence, housekeeping task board — track every issue to close.',
  },
  {
    icon: ClipboardList,
    title: 'Occupant portal',
    desc: 'Residents see balance, upload deposit drafts, submit maintenance requests, view receipts. Less queue at the front desk.',
  },
  {
    icon: Shield,
    title: 'Row-level security',
    desc: 'Every tenant fully isolated at the database level. Encrypted HTTPS connections. Hosted on Supabase + Vercel.',
  },
]

const HOTEL_FEATURES: Feature[] = [
  {
    icon: BedDouble,
    title: 'Reservations & front desk',
    desc: 'Calendar view, walk-in check-in, split payments, room holds. From boutique guesthouses to full-service hotels.',
  },
  {
    icon: CreditCard,
    title: 'MoMo & card payments',
    desc: 'Native Paystack integration. Accept MTN, Vodafone, AirtelTigo MoMo, cards, bank transfers — auto-reconciled to the ledger.',
  },
  {
    icon: BarChart3,
    title: 'GRA-compliant accounting',
    desc: 'Double-entry ledger, chart of accounts, trial balance, P&L, VAT/NHIL/GETFund support. Audit-ready from day one.',
  },
  {
    icon: Users,
    title: 'Staff payroll & shifts',
    desc: 'QR clock-in, shift scheduling, SSNIT / PAYE / Tier-2 deductions, automated payslip generation. SSNIT-ready exports.',
  },
  {
    icon: Globe,
    title: 'Your brand, your domain',
    desc: 'Custom domain (app.yourhotel.com), your logo, your colours. Guest and staff portals that feel like your own product.',
  },
  {
    icon: Bot,
    title: 'AI assistant in Twi & English',
    desc: '"How many rooms are free this weekend?" — Ask in plain English or Twi and get instant answers from your data.',
  },
  {
    icon: Wrench,
    title: 'Maintenance & housekeeping',
    desc: 'Work orders, preventive schedules, meter readings, photo evidence, housekeeping task board — track every issue to close.',
  },
  {
    icon: ClipboardList,
    title: 'Guest self-service portal',
    desc: 'Guests see their balance, view receipts, and submit requests from their phone. Less queue at the front desk.',
  },
  {
    icon: Shield,
    title: 'Row-level security',
    desc: 'Every tenant fully isolated at the database level. Encrypted HTTPS connections. Hosted on Supabase + Vercel.',
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

/** What the free trial includes — each point is stated in the FAQ below. */
const TRIAL_POINTS = [
  'Full Growth plan features',
  'Import existing records from CSV',
  'Your data is kept when you upgrade',
  'Your listing stays up after the trial',
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

  return (
    <div className="min-h-screen bg-white text-bd-ink antialiased">
      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

      <MarketplaceNav />

      <main>
        {/* ── HERO — what it is, the trial, and the real product ───── */}
        <section aria-labelledby="owners-heading" className="overflow-hidden border-b border-bd-ink/10">
          <div className="mx-auto max-w-6xl px-5 pt-12 sm:px-6 sm:pt-20">
            <h1
              id="owners-heading"
              className="max-w-3xl font-display text-[34px] font-bold leading-[1.08] tracking-[-0.02em] sm:text-[48px] lg:text-[56px]"
            >
              {isHotel ? 'Hotel' : 'Hostel'} management software built for Ghana
            </h1>
            <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-bd-slate sm:mt-5 sm:text-[19px]">
              Bookings, Mobile Money, accounting, payroll and the {guestNoun} portal in one
              dashboard, set up for how {nounPlural} in Ghana get paid, taxed and staffed.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={signupHref}
                className="bd-focus inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-bd-teal px-6 text-[15px] font-semibold text-white transition-colors hover:bg-bd-teal-900"
              >
                Start 30-day free trial
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a
                href="#pricing"
                className="bd-focus inline-flex min-h-[48px] items-center justify-center rounded-lg border border-bd-ink/20 bg-white px-6 text-[15px] font-semibold text-bd-ink transition-colors hover:border-bd-ink/40"
              >
                See pricing
              </a>
            </div>
            <p className="mt-4 text-[14px] text-bd-slate">Free for 30 days. No credit card needed.</p>

            {/* The real owner dashboard (sample data), cropped by the
                section edge so it reads as the product, not a poster. */}
            <div className="mt-12 rounded-t-2xl border border-b-0 border-bd-ink/10 bg-bd-mist p-2 pb-0 sm:mt-16 sm:p-3 sm:pb-0 lg:p-4 lg:pb-0">
              <div className="aspect-[1920/1040] overflow-hidden rounded-t-lg border border-b-0 border-bd-ink/10 bg-white">
                <Image
                  src="/owner-dashboard.jpg"
                  alt="Beddilo owner dashboard showing occupancy, monthly revenue, pending bookings and recent bookings, with sample data"
                  width={1920}
                  height={1200}
                  className="h-full w-full object-cover object-top"
                  priority
                  sizes="(min-width: 1152px) 1088px, 100vw"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── FEATURES ────────────────────────────────────────────── */}
        <section
          id="features"
          aria-labelledby="features-heading"
          className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16 sm:px-6 sm:py-24"
        >
          <div className="max-w-2xl">
            <h2 id="features-heading" className="font-display text-[28px] font-bold leading-tight tracking-[-0.015em] sm:text-[36px]">
              Everything you need to run a {nounSingular}
            </h2>
            <p className="mt-3 text-[17px] leading-relaxed text-bd-slate">
              One login for the front desk, the accounts and your staff, with
              Ghana&apos;s payment rails and tax rules built in.
            </p>
          </div>
          <ul className="mt-10 grid gap-x-8 gap-y-8 sm:mt-12 sm:grid-cols-2 sm:gap-y-10 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.title} className="border-t border-bd-ink/10 pt-5">
                <f.icon className="h-6 w-6 text-bd-teal" strokeWidth={1.75} aria-hidden="true" />
                <h3 className="mt-4 text-[16px] font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-bd-slate">{f.desc}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ── COMPARISON ──────────────────────────────────────────── */}
        <section aria-labelledby="compare-heading" className="bg-bd-mist">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-24 lg:grid lg:grid-cols-[1fr_1.7fr] lg:gap-16">
            <div>
              <h2 id="compare-heading" className="font-display text-[28px] font-bold leading-tight tracking-[-0.015em] sm:text-[36px]">
                Why owners switch from spreadsheets
              </h2>
              <p className="mt-3 text-[17px] leading-relaxed text-bd-slate">
                Spreadsheets and older desktop software leave payments, invoices and
                tax work to you. Beddilo handles them as part of every booking.
              </p>
              <Link
                href="/compare/spreadsheet"
                className="bd-focus mt-5 inline-flex min-h-[44px] items-center gap-1.5 rounded text-[15px] font-semibold text-bd-teal hover:underline hover:underline-offset-4"
              >
                Compare in detail <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            <div
              className="bd-focus -mx-5 mt-8 overflow-x-auto px-5 sm:mx-0 sm:px-0 lg:mt-0"
              tabIndex={0}
              role="region"
              aria-labelledby="compare-heading"
            >
              <div className="min-w-[540px] overflow-hidden rounded-xl border border-bd-ink/10 bg-white">
                <table className="w-full text-left text-[15px]">
                  <thead>
                    <tr className="text-[14px]">
                      <th scope="col" className="px-4 py-3.5 font-semibold text-bd-slate sm:px-5">Feature</th>
                      <th scope="col" className="px-3 py-3.5 text-center font-semibold text-bd-slate">Spreadsheets</th>
                      <th scope="col" className="px-3 py-3.5 text-center font-semibold text-bd-slate">Older software</th>
                      <th scope="col" className="bg-bd-teal/[0.06] px-3 py-3.5 text-center font-semibold text-bd-ink">Beddilo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON.map((row) => (
                      <tr key={row.label} className="border-t border-bd-ink/10">
                        <th scope="row" className="px-4 py-3.5 font-normal sm:px-5">{row.label}</th>
                        <td className="px-3 py-3.5 text-center"><CompareMark value={row.spreadsheet} /></td>
                        <td className="px-3 py-3.5 text-center"><CompareMark value={row.traditional} /></td>
                        <td className="bg-bd-teal/[0.06] px-3 py-3.5 text-center"><CompareMark value={row.gh} highlight /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* ── PRICING ─────────────────────────────────────────────── */}
        <section
          id="pricing"
          aria-labelledby="pricing-heading"
          className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16 sm:px-6 sm:py-24"
        >
          <div className="max-w-2xl">
            <h2 id="pricing-heading" className="font-display text-[28px] font-bold leading-tight tracking-[-0.015em] sm:text-[36px]">
              Simple pricing in cedis
            </h2>
            <p className="mt-3 text-[17px] leading-relaxed text-bd-slate">
              Start free and pick a plan when you&apos;re ready. No hidden charges,
              no per-{guestNoun} fees.
            </p>
          </div>

          <PricingPlans
            plans={PLANS}
            isHotel={isHotel}
            lead={
              <div className="flex flex-col rounded-xl bg-bd-mist p-6 sm:col-span-2 sm:p-7 lg:col-span-1">
                <h3 className="text-[16px] font-semibold">Free trial</h3>
                <p className="mt-1 text-[14px] text-bd-slate">Every Growth feature for 30 days</p>
                <p className="mt-6 flex items-baseline gap-1">
                  <span className="text-[15px] font-medium text-bd-slate">GH₵</span>
                  <span className="font-display text-[40px] font-bold leading-none tracking-tight tabular-nums">0</span>
                </p>
                <p className="mt-2 min-h-[40px] text-[13px] text-bd-slate">No credit card needed</p>
                <ul className="mt-6 flex-1 space-y-3">
                  {TRIAL_POINTS.map((point) => (
                    <li key={point} className="flex items-start gap-2.5 text-[15px]">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-bd-teal" strokeWidth={2.5} aria-hidden="true" />
                      {point}
                    </li>
                  ))}
                </ul>
                <Link
                  href={signupHref}
                  className="bd-focus mt-8 inline-flex min-h-[48px] items-center justify-center rounded-lg border border-bd-ink/20 bg-white px-5 text-[15px] font-semibold transition-colors hover:border-bd-ink/40"
                >
                  Start free trial
                </Link>
              </div>
            }
          />
        </section>

        {/* ── FAQ ─────────────────────────────────────────────────── */}
        <section id="faq" aria-labelledby="faq-heading" className="scroll-mt-20 border-t border-bd-ink/10">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-24 lg:grid lg:grid-cols-[1fr_1.7fr] lg:gap-16">
            <div>
              <h2 id="faq-heading" className="font-display text-[28px] font-bold leading-tight tracking-[-0.015em] sm:text-[36px]">
                Frequently asked questions
              </h2>
              <p className="mt-3 text-[16px] leading-relaxed text-bd-slate">
                Something else on your mind? Email{' '}
                <a href="mailto:sales@gh-hostels.com" className="bd-focus whitespace-nowrap rounded font-semibold text-bd-teal underline underline-offset-2">
                  sales@gh-hostels.com
                </a>
                .
              </p>
            </div>
            <div className="mt-8 border-t border-bd-ink/10 lg:mt-0">
              {FAQS.map((faq) => (
                <details key={faq.q} className="group border-b border-bd-ink/10">
                  <summary className="bd-focus flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 py-4 text-[16px] font-semibold [&::-webkit-details-marker]:hidden">
                    {faq.q}
                    <ChevronDown
                      className="h-5 w-5 shrink-0 text-bd-slate transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                  </summary>
                  <p className="pb-5 pr-8 text-[15px] leading-relaxed text-bd-slate">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── CLOSING CTA ─────────────────────────────────────────── */}
        <section aria-labelledby="cta-heading" className="bg-bd-teal text-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-14 sm:px-6 sm:py-20 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <h2 id="cta-heading" className="font-display text-white text-[28px] font-bold leading-tight tracking-[-0.015em] sm:text-[36px]">
                Try Beddilo free for 30 days
              </h2>
              <p className="mt-3 text-[17px] leading-relaxed text-white/80">
                Every Growth feature, no credit card needed. Your listing stays up
                after the trial.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:shrink-0">
              <Link
                href={signupHref}
                className="bd-focus-on-dark inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-white px-6 text-[15px] font-semibold text-bd-teal transition-colors hover:bg-bd-mist"
              >
                Start free trial <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a
                href="mailto:sales@gh-hostels.com"
                className="bd-focus-on-dark inline-flex min-h-[48px] items-center justify-center rounded-lg border border-white/30 px-6 text-[15px] font-semibold text-white transition-colors hover:bg-white/10"
              >
                Talk to sales
              </a>
            </div>
          </div>
        </section>
      </main>

      <MarketplaceFooter />
    </div>
  )
}

/* ── Helpers ──────────────────────────────────────────────────── */

function CompareMark({ value, highlight }: { value: CompareValue; highlight?: boolean }) {
  if (value === true) {
    return (
      <>
        <Check
          className={`mx-auto h-5 w-5 ${highlight ? 'text-bd-teal' : 'text-bd-slate'}`}
          strokeWidth={2.5}
          aria-hidden="true"
        />
        <span className="sr-only">Yes</span>
      </>
    )
  }
  if (value === 'manual') return <span className="text-[14px] text-bd-slate">Manual</span>
  if (value === 'partial') return <span className="text-[14px] text-bd-slate">Partial</span>
  return (
    <>
      <Minus className="mx-auto h-4 w-4 text-bd-ink/30" aria-hidden="true" />
      <span className="sr-only">No</span>
    </>
  )
}
