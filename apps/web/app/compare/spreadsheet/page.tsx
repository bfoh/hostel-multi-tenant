import type { Metadata } from 'next'

import { CompareShell, type CompareRow } from '@/components/public/compare-shell'

const SITE_URL = 'https://gh-hostels.com'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Replace Your Hostel Spreadsheet — GH Hostels vs Excel',
  description:
    'Stop running your hostel from Excel. GH Hostels replaces the room sheet, the MoMo log, the receipt book, the payroll workbook, and the maintenance log — in one Ghanaian platform.',
  keywords: [
    'replace excel hostel',
    'hostel spreadsheet alternative',
    'hostel management spreadsheet ghana',
    'stop using excel hostel',
    'hostel google sheets to software',
    'hostel excel template replacement',
    'hostel management software ghana',
  ],
  alternates: { canonical: `${SITE_URL}/compare/spreadsheet` },
  openGraph: {
    type: 'article',
    locale: 'en_GH',
    url: `${SITE_URL}/compare/spreadsheet`,
    siteName: 'GH Hostels',
    title: 'Replace your hostel spreadsheet with GH Hostels',
    description:
      'The room sheet, the MoMo log, the receipt book, the payroll workbook — one platform replaces them all.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stop running your hostel from Excel.',
    description:
      'Replace your spreadsheet stack with one Ghanaian platform — MoMo, GRA accounting, payroll.',
  },
  robots: { index: true, follow: true },
}

const ROWS: CompareRow[] = [
  {
    capability: 'Real-time occupancy at a glance',
    competitor: false,
    gh: true,
    detail: 'Live Gantt calendar. No "is this room still booked?" calls.',
  },
  {
    capability: 'MoMo payments auto-reconciled',
    competitor: false,
    gh: true,
    detail: 'Paystack hooks every MoMo/card payment to a booking and the ledger.',
  },
  {
    capability: 'Auto-generated invoices & receipts',
    competitor: 'manual',
    gh: true,
  },
  {
    capability: 'GRA-compliant double-entry accounting',
    competitor: false,
    gh: true,
    detail: 'Trial balance, P&L, balance sheet — formatted for GRA filing.',
  },
  {
    capability: 'Payroll with SSNIT + PAYE',
    competitor: 'manual',
    gh: true,
    detail: 'Auto-calculated deductions, payslips, SSNIT export.',
  },
  {
    capability: 'Occupant self-service portal',
    competitor: false,
    gh: true,
    detail: 'Residents see balance, upload drafts, request maintenance.',
  },
  {
    capability: 'ID verification queue',
    competitor: false,
    gh: true,
  },
  {
    capability: 'Maintenance & housekeeping tracking',
    competitor: 'manual',
    gh: true,
  },
  {
    capability: 'Multi-property portfolio view',
    competitor: false,
    gh: true,
  },
  {
    capability: 'Daily off-site encrypted backups',
    competitor: false,
    gh: true,
    detail: 'No more "the laptop crashed and the rent sheet went with it."',
  },
  {
    capability: 'Audit log of every change',
    competitor: false,
    gh: true,
  },
  {
    capability: 'Works on a phone',
    competitor: 'partial',
    gh: true,
  },
  {
    capability: 'AI assistant in Twi + English',
    competitor: false,
    gh: true,
  },
  {
    capability: 'Survives staff turnover',
    competitor: false,
    gh: true,
    detail: 'Workflow lives in the system, not in one person’s head.',
  },
]

const REASONS = [
  {
    title: 'Spreadsheets don’t take MoMo',
    body: 'In Ghana, rent moves on MoMo. A spreadsheet can record a payment after the fact, but it can’t generate the receipt, debit the booking balance, post to the journal, and trigger a notification — all in one click.',
  },
  {
    title: 'One source of truth, finally',
    body: 'Most hostels run on 4–6 spreadsheets: rooms, occupants, payments, maintenance, payroll, complaints. None of them agree. GH Hostels collapses all of it into one consistent data model.',
  },
  {
    title: 'Auditable forever',
    body: 'Every booking change, every payment, every refund — logged with who did it and when. A spreadsheet shows the current state. GH Hostels shows the full history.',
  },
  {
    title: 'Recover from disasters',
    body: 'Encrypted daily backups, hosted on Supabase + Vercel. No more "the cleaning lady deleted a tab" or "the laptop got stolen". Your data is safe.',
  },
  {
    title: 'Front desk runs without you',
    body: 'When the front desk is in Excel, every check-in needs the senior manager. With GH Hostels, the work is in the system — your staff just runs the playbook.',
  },
  {
    title: 'Scales to multiple properties',
    body: 'Spreadsheets break the moment you open a second hostel. GH Hostels gives you a portfolio dashboard from day one — occupancy, revenue, KPIs across every property.',
  },
]

const FAQS = [
  {
    q: 'Honestly, can’t I just keep using Excel?',
    a: 'For very small hostels (under 20 rooms, family-run, one location), Excel is fine until growth makes it painful. The moment you accept MoMo, hire a second staff member, or open a second property, the spreadsheet starts losing data and consuming hours. We’ve seen the same story dozens of times — the migration usually pays for itself in 4–6 weeks.',
  },
  {
    q: 'How long does migration from Excel take?',
    a: 'Typical 100-room hostel: one afternoon. You send us your existing room list, occupant directory, and current balances. We import them, you verify, and you’re live by the next morning. Growth and Pro plans include guided onboarding.',
  },
  {
    q: 'What if I want to keep a copy of the data in Excel?',
    a: 'Every report in GH Hostels exports to Excel, CSV, and PDF. Trial balance, P&L, occupant directory, payment history — all exportable. You can keep doing whatever Excel ritual you like; we just stop being the source of truth.',
  },
  {
    q: 'Will my staff need training?',
    a: 'Most front-desk workflows take 20 minutes to learn. Accounting/payroll modules need a couple of hours with the bursar. We do a guided onboarding session for Growth and Pro plans and provide WhatsApp support whenever you need it.',
  },
  {
    q: 'Is it really cheaper than running Excel?',
    a: 'Excel is "free" only on the licence. The real cost is in admin hours, missed payments, GRA fines, payroll mistakes, and the lost revenue from rooms that sit empty because nobody updated the sheet. Most hostels recover the GH₵ 500–1,000/month subscription within the first month.',
  },
  {
    q: 'Will my data stay in Ghana?',
    a: 'Data is hosted on managed cloud infrastructure with daily backups. Each tenant is fully isolated using Postgres row-level security. We can configure regional residency on Enterprise plans if you require it.',
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

export default function SpreadsheetComparePage() {
  return (
    <CompareShell
      competitorName="Spreadsheets"
      competitorTagline="What you gain when the hostel stops living in tabs."
      pageEyebrow="Replace your spreadsheet stack"
      pageHeadline={
        <>
          Your hostel deserves better
          <span
            className="block italic"
            style={{ color: 'rgba(245,233,210,0.55)' }}
          >
            than tab 4 of &ldquo;rooms_final_v3.xlsx&rdquo;.
          </span>
        </>
      }
      pageSub="Most Ghanaian hostels start in Excel or Google Sheets. It works — until MoMo arrives, until staff turnover, until the GRA letter shows up. Here’s what changes when you move to a system designed for the job."
      intro={
        <>
          <p>
            There&apos;s nothing wrong with Excel. We use it ourselves. It&apos;s the universal
            duct-tape of small business, and for a 12-room hostel where the owner takes every
            payment in person, a spreadsheet is honestly fine.
          </p>
          <p>The trouble starts at the moments most hostel owners can name from memory:</p>
          <ul>
            <li>
              The day a resident swears they paid the deposit by MoMo, and you spend two hours
              scrolling MTN&apos;s app.
            </li>
            <li>
              The Friday SSNIT and PAYE calculations took until 9pm because three salaries were off
              by a few pesewas.
            </li>
            <li>The week the accountant quit, taking three undocumented spreadsheets with her.</li>
            <li>The GRA filing where nobody could agree on revenue for Q2.</li>
            <li>The empty room nobody knew was empty for three weeks.</li>
          </ul>
          <p>
            None of these are unusual. They&apos;re what happens when a multi-million cedi
            operation runs on a tool designed for a single accountant&apos;s desk in 1985.
          </p>
          <p>
            <strong>GH Hostels</strong> is what a spreadsheet would look like if it had been
            designed for a Ghanaian hostel in 2026 — with MoMo, GRA, SSNIT, and occupants who
            expect to see their balance on a phone.
          </p>
        </>
      }
      rows={ROWS}
      reasons={REASONS}
      faqs={FAQS}
      bottomLine={
        <>
          Close the spreadsheet.
          <span className="block italic platform-shimmer-text">Open something better.</span>
        </>
      }
      jsonLd={jsonLd}
    />
  )
}
