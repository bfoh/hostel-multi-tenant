import type { Metadata } from 'next'

import { CompareShell, type CompareRow } from '@/components/public/compare-shell'

const SITE_URL = 'https://gh-hostels.com'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Cloudbeds Alternative for Ghana — GH Hostels vs Cloudbeds',
  description:
    'Looking for a Cloudbeds alternative for your Ghanaian hostel? GH Hostels is built in Ghana with native Paystack MoMo, GRA-compliant accounting, SSNIT/PAYE payroll, and pricing in cedis. Side-by-side comparison.',
  keywords: [
    'cloudbeds alternative ghana',
    'cloudbeds alternative africa',
    'hostel management software ghana',
    'cloudbeds vs gh hostels',
    'hostel software ghana cloudbeds',
    'paystack hostel software',
    'gra accounting hostel',
  ],
  alternates: { canonical: `${SITE_URL}/compare/cloudbeds` },
  openGraph: {
    type: 'article',
    locale: 'en_GH',
    url: `${SITE_URL}/compare/cloudbeds`,
    siteName: 'GH Hostels',
    title: 'GH Hostels vs Cloudbeds — built for Ghana',
    description:
      'Native Paystack MoMo, GRA-compliant accounting, SSNIT payroll, cedis pricing. See the feature-by-feature comparison.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GH Hostels vs Cloudbeds — built for Ghana',
    description:
      'Native MoMo, GRA accounting, cedis pricing — the Cloudbeds alternative for Ghanaian hostels.',
  },
  robots: { index: true, follow: true },
}

const ROWS: CompareRow[] = [
  {
    capability: 'Native Mobile Money (MTN, Vodafone, AirtelTigo)',
    competitor: false,
    gh: true,
    detail: 'Paystack-powered — auto-reconciled to bookings and ledger.',
  },
  {
    capability: 'GRA-compliant accounting (VAT/NHIL/GETFund)',
    competitor: false,
    gh: true,
    detail: 'Double-entry ledger built around the GRA filing checklist.',
  },
  {
    capability: 'SSNIT + PAYE payroll',
    competitor: 'addon',
    gh: true,
    detail: 'Ghana tax engine, payslip generation, SSNIT export ready.',
  },
  {
    capability: 'Pricing in Ghana cedis',
    competitor: false,
    gh: true,
    detail: 'From GH₵ 800/month. No FX swings. No card-only billing.',
  },
  {
    capability: 'Bank draft / deposit slip workflow',
    competitor: false,
    gh: true,
    detail: 'Residents upload drafts; owner/accountant verifies in a queue.',
  },
  {
    capability: 'AI assistant in Twi + English',
    competitor: false,
    gh: true,
    detail: 'Ask "How many rooms are free this weekend?" in plain language.',
  },
  {
    capability: 'Custom domain + tenant branding',
    competitor: 'partial',
    gh: true,
    detail: 'app.yourhostel.com with your logo & colors. SSL handled.',
  },
  {
    capability: 'Multi-property portfolio view',
    competitor: true,
    gh: true,
  },
  {
    capability: 'Front-desk kiosk / walk-in mode',
    competitor: 'partial',
    gh: true,
  },
  {
    capability: 'Occupant self-service portal',
    competitor: 'partial',
    gh: true,
    detail: 'Balance view, draft upload, maintenance requests, receipts.',
  },
  {
    capability: 'Built-in maintenance & housekeeping',
    competitor: 'partial',
    gh: true,
  },
  {
    capability: 'WhatsApp + local language support',
    competitor: false,
    gh: true,
    detail: 'Accra office. WhatsApp on every paid plan.',
  },
  {
    capability: 'Onboarding included',
    competitor: 'addon',
    gh: true,
    detail: 'Growth plan gets a guided onboarding call at no extra cost.',
  },
]

const REASONS = [
  {
    title: 'Native MoMo, not a workaround',
    body: 'Cloudbeds expects card or bank rails. In Ghana, 80%+ of rent moves on MTN MoMo and Vodafone Cash. We integrate Paystack natively and reconcile every payment to the booking and ledger.',
  },
  {
    title: 'GRA tax engine built in',
    body: 'VAT, NHIL, GETFund, COVID-19 levy — handled in the chart of accounts. Trial balance and P&L exports match the GRA filing format, not a US tax model.',
  },
  {
    title: 'SSNIT + PAYE payroll, no add-on',
    body: 'Cloudbeds payroll is a third-party connector. Ours is built in — calculate SSNIT Tier 1/2/3, PAYE bands, and generate payslips from a single screen.',
  },
  {
    title: 'Cedis pricing, no FX shock',
    body: 'You pay GH₵ 800–1,000/month. No USD-to-GHS conversion bills that triple in a year. We price for the market we serve.',
  },
  {
    title: 'Local support, in Accra',
    body: 'Email, WhatsApp, and phone support from a team that lives in Ghana. We pick up. We speak Twi when it helps.',
  },
  {
    title: 'Built for student hostels first',
    body: 'Cloudbeds optimises for hotels and short-stay hostels. We optimise for the academic-year rental model: long stays, deposit drafts, ID verification, ROAR/RAL waiting lists.',
  },
]

const FAQS = [
  {
    q: 'Is GH Hostels really an alternative to Cloudbeds?',
    a: 'Yes — for hostels operating in Ghana and West Africa. Cloudbeds is a strong global tool, but it was designed for short-stay hotels and hostels in markets with card-dominant rails. If your hostel collects MoMo rent, files GRA taxes, and runs payroll for staff under SSNIT, GH Hostels gives you those workflows native and in your currency.',
  },
  {
    q: 'Can I migrate from Cloudbeds to GH Hostels?',
    a: 'Yes. Export your rooms, occupants, bookings, and payment history from Cloudbeds. We import them for you during onboarding on the Growth plan — typically completed in one afternoon for a 100-room hostel.',
  },
  {
    q: 'How does pricing compare?',
    a: 'Cloudbeds bills in USD with per-room pricing that scales aggressively past 50 rooms. GH Hostels is fixed GHS pricing: GH₵ 800/month up to 50 rooms (Starter) and GH₵ 1,000/month unlimited (Growth). No per-occupant fees.',
  },
  {
    q: 'Does Cloudbeds support Paystack?',
    a: 'Cloudbeds integrates with Stripe and a small set of regional processors. There is no native Paystack or MTN MoMo integration as of writing. You can manually reconcile MoMo payments, but they do not flow into the booking or accounting layer automatically.',
  },
  {
    q: 'Will I lose features by switching?',
    a: 'Most Ghana-based hostels use a small slice of Cloudbeds (rate plans, channel manager, basic reporting). GH Hostels covers all of that. If you rely on multi-currency channel-manager listings for international tourists, we recommend keeping Cloudbeds for that property. For student hostels, we cover the full operating system.',
  },
  {
    q: 'Is my data safe during migration?',
    a: 'Yes. Each tenant is fully isolated with Postgres row-level security. Encryption at rest and in transit. Daily off-site backups. Cloudbeds export is read-only — your existing system stays untouched until you switch over.',
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
      competitorTagline="Side-by-side capabilities for hostels operating in Ghana and West Africa."
      pageEyebrow="The Ghanaian alternative"
      pageHeadline={
        <>
          A Cloudbeds alternative,
          <span
            className="block italic"
            style={{ color: 'rgba(245,233,210,0.55)' }}
          >
            built in Ghana.
          </span>
        </>
      }
      pageSub="Cloudbeds is a powerful global PMS. But it was designed for hotels in markets where Stripe and Visa do the heavy lifting. In Ghana, rent moves on MoMo, taxes go to GRA, and staff payroll runs through SSNIT. GH Hostels was built around those realities."
      intro={
        <>
          <p>
            If you operate a student hostel anywhere from Legon to Cape Coast, you&apos;ve probably
            looked at <strong>Cloudbeds</strong>, <strong>Hostfully</strong>, or{' '}
            <strong>Mews</strong> at some point. They&apos;re excellent products — for the markets
            they were designed for. The problem starts when you try to bend a Western property
            management system around{' '}
            <strong>
              MTN Mobile Money, GRA tax codes, SSNIT payroll deductions, and academic-year tenancy
            </strong>
            .
          </p>
          <p>
            We built <strong>GH Hostels</strong> because we kept seeing the same patterns at every
            Ghanaian hostel we worked with:
          </p>
          <ul>
            <li>MoMo screenshots living in WhatsApp groups, hand-matched to receipts each week.</li>
            <li>
              A second spreadsheet for the bursar that nobody ever trusted to be the single source
              of truth.
            </li>
            <li>
              A &ldquo;payroll day&rdquo; that consumed a full Friday because SSNIT calculations
              were done in Excel.
            </li>
            <li>Front desks bottlenecked behind paper receipt books.</li>
          </ul>
          <p>
            None of that is the hostel owner&apos;s fault. It&apos;s a product gap. This page is a
            no-spin look at where <strong>GH Hostels</strong> diverges from Cloudbeds — and where
            Cloudbeds is still the better choice (a multi-property hotel group with international
            OTA listings, for instance, should stay with Cloudbeds).
          </p>
        </>
      }
      rows={ROWS}
      reasons={REASONS}
      faqs={FAQS}
      bottomLine={
        <>
          Try GH Hostels.
          <span className="block italic platform-shimmer-text">
            Keep Cloudbeds if you still need it.
          </span>
        </>
      }
      jsonLd={jsonLd}
    />
  )
}
