import type { Metadata } from 'next'

import { CompareShell, type CompareRow } from '@/components/public/compare-shell'

const SITE_URL = 'https://gh-hostels.com'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { absolute: 'Cloudbeds Alternative for Ghana — Beddilo vs Cloudbeds' },
  description:
    'Looking for a Cloudbeds alternative for your Ghanaian hostel or hotel? Beddilo is built in Ghana with native Paystack MoMo, GRA-compliant accounting, SSNIT/PAYE payroll, and pricing in cedis. See what Beddilo includes.',
  keywords: [
    'cloudbeds alternative ghana',
    'cloudbeds alternative africa',
    'hostel management software ghana',
    'hotel management software ghana',
    'cloudbeds vs beddilo',
    'hostel software ghana cloudbeds',
    'paystack hostel software',
    'gra accounting hostel',
  ],
  alternates: { canonical: `${SITE_URL}/compare/cloudbeds` },
  openGraph: {
    type: 'article',
    locale: 'en_GH',
    url: `${SITE_URL}/compare/cloudbeds`,
    siteName: 'Beddilo',
    title: 'Beddilo vs Cloudbeds — built for Ghana',
    description:
      'Native Paystack MoMo, GRA-compliant accounting, SSNIT payroll, cedis pricing. See what Beddilo includes.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Beddilo vs Cloudbeds — built for Ghana',
    description:
      'Native MoMo, GRA accounting, cedis pricing — the Cloudbeds alternative for Ghanaian hostels and hotels.',
  },
  robots: { index: true, follow: true },
}

// Beddilo's column only: we haven't verified Cloudbeds' current features or
// pricing, so this page makes no claims about them.
const ROWS: CompareRow[] = [
  {
    capability: 'Native Mobile Money (MTN, Vodafone, AirtelTigo)',
    gh: true,
    detail: 'Paystack-powered — auto-reconciled to bookings and ledger.',
  },
  {
    capability: 'GRA-compliant accounting (VAT/NHIL/GETFund)',
    gh: true,
    detail: 'Double-entry ledger built around the GRA filing checklist.',
  },
  {
    capability: 'SSNIT + PAYE payroll',
    gh: true,
    detail: 'Ghana tax engine, payslip generation, SSNIT export ready.',
  },
  {
    capability: 'Pricing in Ghana cedis',
    gh: true,
    detail: 'Hostel plans from GH₵ 800/month, billed in cedis.',
  },
  {
    capability: 'Bank draft / deposit slip workflow',
    gh: true,
    detail: 'Residents upload drafts; owner/accountant verifies in a queue.',
  },
  {
    capability: 'AI assistant in Twi + English',
    gh: true,
    detail: 'Ask "How many rooms are free this weekend?" in plain language.',
  },
  {
    capability: 'Custom domain + tenant branding',
    gh: true,
    detail: 'app.yourhostel.com with your logo & colors. SSL handled.',
  },
  {
    capability: 'Multi-property portfolio view',
    gh: true,
  },
  {
    capability: 'Front-desk kiosk / walk-in mode',
    gh: true,
  },
  {
    capability: 'Occupant self-service portal',
    gh: true,
    detail: 'Balance view, draft upload, maintenance requests, receipts.',
  },
  {
    capability: 'Built-in maintenance & housekeeping',
    gh: true,
  },
  {
    capability: 'CSV import for rooms, occupants and bookings',
    gh: true,
    detail: 'Bring existing records across yourself, at your own pace.',
  },
]

const REASONS = [
  {
    title: 'Native MoMo, not a workaround',
    body: 'In Ghana, rent often moves on mobile money. Beddilo takes MoMo and card through Paystack and matches every payment to the booking and the ledger.',
  },
  {
    title: 'GRA tax engine built in',
    body: 'VAT, NHIL, GETFund, COVID-19 levy — handled in the chart of accounts, with trial balance and P&L exports laid out for GRA filing.',
  },
  {
    title: 'SSNIT + PAYE payroll, no add-on',
    body: 'Payroll is part of Beddilo: calculate SSNIT Tier 1/2/3 and PAYE bands, and generate payslips from a single screen.',
  },
  {
    title: 'Cedis pricing',
    body: 'Hostel plans are GH₵ 800 or GH₵ 1,000 a month, billed in cedis. We price for the market we serve.',
  },
  {
    title: 'Built for how Ghana actually books',
    body: 'Beddilo is built around how stays run here — MoMo rent, GRA tax codes, SSNIT payroll — whether you run a campus hostel or a city hotel.',
  },
]

const FAQS = [
  {
    q: 'Is Beddilo really an alternative to Cloudbeds?',
    a: 'Beddilo is built for hostels and hotels operating in Ghana. If your property collects MoMo rent, files GRA taxes, and runs payroll for staff under SSNIT, those workflows are built in and priced in cedis. Check Cloudbeds’ current features and pricing with Cloudbeds directly — this page only describes Beddilo.',
  },
  {
    q: 'Can I move my data from Cloudbeds to Beddilo?',
    a: 'If you can export your rooms, guests and bookings to CSV, you can bring them in with Beddilo’s import tools for rooms, occupants and bookings. Importing into Beddilo doesn’t change anything in your Cloudbeds account.',
  },
  {
    q: 'What does Beddilo cost?',
    a: 'Hostel plans are a fixed monthly price in cedis: GH₵ 800/month for up to 50 rooms (Starter) and GH₵ 1,000/month with unlimited rooms (Growth). No per-occupant fees. Quarterly, 6-month and yearly billing are discounted.',
  },
  {
    q: 'Which payment methods does Beddilo take?',
    a: 'Guests can pay online with MTN MoMo, Vodafone Cash, AirtelTigo Money or card through Paystack. Staff can also record offline payments such as cash against a booking, and residents can upload bank drafts for verification.',
  },
  {
    q: 'Is there anything Beddilo doesn’t do?',
    a: 'Beddilo doesn’t include a channel manager for global OTAs such as Booking.com, Expedia or Airbnb. If you rely on those listings for international guests, keep a tool that handles them.',
  },
  {
    q: 'Is my data safe when I switch?',
    a: 'Each tenant is fully isolated with Postgres row-level security, and everything travels over encrypted HTTPS connections. Importing into Beddilo doesn’t change your Cloudbeds data.',
  },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
}

export default function CloudbedsComparePage() {
  return (
    <CompareShell
      competitorName="Cloudbeds"
      competitorTagline="For hostels and hotels operating in Ghana."
      tableHeading="What Beddilo includes"
      pageEyebrow="The Ghanaian alternative"
      pageHeadline={
        <>
          A Cloudbeds alternative,
          <span
            className="block"
            style={{ color: 'rgba(247,242,233,0.72)' }}
          >
            built in Ghana.
          </span>
        </>
      }
      pageSub="Cloudbeds is a well-known global PMS. In Ghana, rent moves on MoMo, taxes go to GRA, and staff payroll runs through SSNIT. Beddilo was built around those realities — for hostels and hotels alike."
      intro={
        <>
          <p>
            If you run a hostel or hotel anywhere from Legon to Cape Coast, you&apos;ve probably
            looked at <strong>Cloudbeds</strong>, <strong>Hostfully</strong>, or{' '}
            <strong>Mews</strong> at some point. Whichever system you choose, the question is how
            well it handles{' '}
            <strong>
              MTN Mobile Money, GRA tax codes, and SSNIT payroll deductions
            </strong>
            .
          </p>
          <p>
            <strong>Beddilo</strong> is built for the problems that show up when those don&apos;t
            fit:
          </p>
          <ul>
            <li>MoMo screenshots living in WhatsApp groups, hand-matched to receipts each week.</li>
            <li>
              A second spreadsheet for the bursar or front-desk manager that nobody ever trusted to
              be the single source of truth.
            </li>
            <li>
              A &ldquo;payroll day&rdquo; that consumed a full Friday because SSNIT calculations
              were done in Excel.
            </li>
            <li>Front desks bottlenecked behind paper receipt books.</li>
          </ul>
          <p>
            This page describes what <strong>Beddilo</strong> includes; check Cloudbeds&apos;
            current features and pricing with Cloudbeds directly. Beddilo has no channel manager
            for global OTAs (Booking.com, Expedia, Airbnb), so a property that depends on those
            listings for international tourists should keep a tool that handles them.
          </p>
        </>
      }
      rows={ROWS}
      reasons={REASONS}
      faqs={FAQS}
      bottomLine={
        <>
          Try Beddilo.
          <span className="block platform-shimmer-text">
            Keep Cloudbeds if you still need it.
          </span>
        </>
      }
      jsonLd={jsonLd}
    />
  )
}
