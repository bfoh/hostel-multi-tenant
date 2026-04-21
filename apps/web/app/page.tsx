import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  BedDouble, TrendingUp, Shield, Zap, Check, ArrowRight,
  Building2, CreditCard, FileText, Users, Globe, Sparkles,
} from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { listPlatformPlans } from '@/lib/platform-plans'

export const metadata: Metadata = {
  title: 'GH Hostels — Modern hostel management for Ghana',
  description:
    'Bookings, payments, housekeeping, and accounting in one dashboard. Built for Ghanaian hostels. Start a 30-day free trial.',
  robots: { index: true, follow: true },
}

export const dynamic = 'force-dynamic'

export default async function LandingPage() {
  const headersList = await headers()

  // Tenant subdomain hit this route → send to dashboard
  if (headersList.get('x-tenant-id')) redirect('/dashboard')

  // Platform root + signed in → skip marketing, go to dashboard
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  const plans = listPlatformPlans()

  return (
    <div className="min-h-[100dvh] bg-white text-slate-900">
      <LandingNav />
      <Hero />
      <TrustBar />
      <Features />
      <Pricing plans={plans} />
      <Faq />
      <Cta />
      <Footer />
    </div>
  )
}

/* ─── Nav ───────────────────────────────────────────────────────────── */

function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-md shadow-blue-900/20">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path d="M3 11L12 3l9 8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="5" y="11" width="14" height="10" rx="1" fill="white" opacity="0.2"/>
              <rect x="7" y="13" width="3.5" height="3.5" rx="0.5" fill="white"/>
              <rect x="13.5" y="13" width="3.5" height="3.5" rx="0.5" fill="white"/>
              <rect x="9.5" y="17" width="5" height="4" rx="0.5" fill="white"/>
            </svg>
          </div>
          <span className="font-display text-lg font-bold tracking-tight">GH Hostels</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm font-medium text-slate-600 hover:text-slate-900">Features</a>
          <a href="#pricing" className="text-sm font-medium text-slate-600 hover:text-slate-900">Pricing</a>
          <a href="#faq"     className="text-sm font-medium text-slate-600 hover:text-slate-900">FAQ</a>
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden text-sm font-semibold text-slate-700 hover:text-slate-900 sm:block">
            Sign in
          </Link>
          <Link
            href="/signup?plan=trial"
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 active:scale-[0.98]"
          >
            Start free trial
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </header>
  )
}

/* ─── Hero ──────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-slate-200/60">
      <div
        className="absolute inset-0 -z-10 opacity-[0.35]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 15% 10%, rgba(59,130,246,0.12), transparent 45%),' +
            'radial-gradient(circle at 85% 30%, rgba(14,165,233,0.10), transparent 50%)',
        }}
      />
      <div
        className="absolute inset-0 -z-10 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgb(15 23 42) 1px, transparent 1px),' +
            'linear-gradient(to bottom, rgb(15 23 42) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at top, black, transparent 70%)',
        }}
      />

      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/70 bg-blue-50/60 px-3.5 py-1.5 backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-semibold tracking-wide text-blue-700">
            Built for Ghana&apos;s hostels
          </span>
        </div>

        <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
          Run your hostel
          <br />
          <span className="bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-700 bg-clip-text text-transparent">
            like it&apos;s 2026.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-[620px] text-lg text-slate-600 leading-relaxed">
          Bookings, payments, housekeeping, staff payroll, and full accounting — one dashboard,
          priced in Ghana cedis, built for the way hostels here actually work.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/signup?plan=trial"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 active:scale-[0.98] sm:w-auto"
          >
            Start 30-day free trial
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#pricing"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
          >
            See pricing
          </a>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          No credit card required. Cancel anytime.
        </p>
      </div>
    </section>
  )
}

/* ─── Trust bar ─────────────────────────────────────────────────────── */

function TrustBar() {
  const items = [
    { value: '500+',       label: 'Hostels managed'    },
    { value: 'GH₵ 2M+',    label: 'Monthly volume'     },
    { value: '99.9%',      label: 'Uptime'             },
    { value: 'GRA-ready',  label: 'Payroll tax engine' },
  ]
  return (
    <section className="border-b border-slate-200/60 bg-slate-50/50">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-6 py-8 md:grid-cols-4">
        {items.map((i) => (
          <div key={i.label} className="text-center md:text-left">
            <p className="font-display text-xl font-bold tracking-tight">{i.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{i.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ─── Features ──────────────────────────────────────────────────────── */

function Features() {
  const features = [
    {
      icon:  BedDouble,
      title: 'Real-time bookings',
      body:  'Online booking page per hostel. Overbooking guard. Deposit, balance, and check-in tracking with zero spreadsheets.',
    },
    {
      icon:  CreditCard,
      title: 'Paystack payments',
      body:  'Mobile money, cards, bank transfer. Money lands in your Paystack account — we never hold it. Automated receipts.',
    },
    {
      icon:  FileText,
      title: 'Double-entry accounting',
      body:  'Proper journals, ledgers, trial balance, and P&L. No more reconciliation headaches at term-end.',
    },
    {
      icon:  Users,
      title: 'Staff & payroll',
      body:  'SSNIT, PAYE, and GRA-compliant payslips. Manage staff roles, shifts, and leave from one place.',
    },
    {
      icon:  Shield,
      title: 'Occupant verification',
      body:  'Ghana Card upload, guarantor records, and digital lease tracking. Audit trail on every change.',
    },
    {
      icon:  Globe,
      title: 'Custom domain + branding',
      body:  'Your hostel, your colour, your logo, your URL. Guests see your brand — not ours.',
    },
  ]

  return (
    <section id="features" className="border-b border-slate-200/60">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Everything in one place</p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            The whole back-office, one login.
          </h2>
          <p className="mt-3 text-slate-600">
            Stop stitching together WhatsApp, Excel, and hand-written ledgers. GH Hostels
            covers the full lifecycle — from a prospective guest&apos;s first click to year-end books.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-slate-200/80 bg-white p-6 transition-shadow hover:shadow-sm"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                <f.icon className="h-5 w-5 text-blue-600" strokeWidth={1.8} />
              </div>
              <h3 className="mt-4 font-display text-base font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Pricing ───────────────────────────────────────────────────────── */

function Pricing({ plans }: { plans: ReturnType<typeof listPlatformPlans> }) {
  const highlight: Record<string, boolean> = { growth: true }

  return (
    <section id="pricing" className="border-b border-slate-200/60 bg-slate-50/50">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Pricing</p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Simple plans. Cedi pricing. No setup fees.
          </h2>
          <p className="mt-3 text-slate-600">
            Billed monthly via Paystack. Upgrade, downgrade, or cancel any time — access continues
            until the end of your paid period.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {plans.map((p) => {
            const isHighlight = highlight[p.name]
            return (
              <div
                key={p.name}
                className={[
                  'relative rounded-2xl border p-7 flex flex-col',
                  isHighlight
                    ? 'border-blue-600 bg-white shadow-lg shadow-blue-900/5 ring-1 ring-blue-600/20'
                    : 'border-slate-200/80 bg-white',
                ].join(' ')}
              >
                {isHighlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                    Most popular
                  </div>
                )}

                <h3 className="font-display text-lg font-bold">{p.displayName}</h3>
                <p className="mt-1 text-sm text-slate-600">{p.description}</p>

                <div className="mt-5 flex items-baseline gap-1.5">
                  <span className="font-display text-4xl font-extrabold tracking-tight">
                    GH₵ {(p.amountPesewas / 100).toLocaleString()}
                  </span>
                  <span className="text-sm text-slate-500">/ month</span>
                </div>

                <ul className="mt-6 space-y-2.5 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2.5} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={`/signup?plan=${p.name}`}
                  className={[
                    'mt-7 inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all active:scale-[0.98]',
                    isHighlight
                      ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
                      : 'bg-slate-900 text-white hover:bg-slate-800',
                  ].join(' ')}
                >
                  Subscribe
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )
          })}
        </div>

        {/* Trial option */}
        <div className="mt-8 rounded-2xl border border-slate-200/80 bg-white px-6 py-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
              <Sparkles className="h-5 w-5 text-amber-600" strokeWidth={1.8} />
            </div>
            <div>
              <p className="font-display text-base font-semibold">Not ready to commit?</p>
              <p className="text-sm text-slate-600">
                Start a 30-day free trial. All Growth features, no card. Pick a plan whenever you&apos;re ready.
              </p>
            </div>
          </div>
          <Link
            href="/signup?plan=trial"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Start free trial
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  )
}

/* ─── FAQ ───────────────────────────────────────────────────────────── */

function Faq() {
  const faqs = [
    {
      q: 'Do I pay a separate fee on guest payments?',
      a: 'No. Guest bookings flow through Paystack straight to your account — you only pay Paystack\'s standard processing fee. The platform subscription is the only fee you pay us.',
    },
    {
      q: 'Can I use my own domain?',
      a: 'Yes. Every hostel gets a free *.gh-hostels.com subdomain out of the box. On any paid plan you can point your own domain (e.g. bookings.yourhostel.com) at us — we handle the SSL automatically.',
    },
    {
      q: 'What happens when my trial ends?',
      a: 'Nothing destructive. You keep read-access to your data; pick any paid plan to re-enable bookings, payments, and new occupant creation. We never delete your hostel or records.',
    },
    {
      q: 'Is the accounting GRA-ready?',
      a: 'Payroll is GRA-compliant (PAYE bands, SSNIT tier 1). The accounting module uses proper double-entry with a ledger your accountant can export to any reporting format.',
    },
    {
      q: 'Can I migrate from Excel or another system?',
      a: 'Yes — our team helps with one-time data import for Growth and Pro plans. Bring rooms, occupants, and outstanding balances in a CSV and we\'ll map the fields.',
    },
    {
      q: 'How do upgrades and downgrades work?',
      a: 'Change plan any time from Settings → Billing. Upgrades take effect immediately; downgrades apply from your next renewal. Paystack handles proration automatically.',
    },
  ]

  return (
    <section id="faq" className="border-b border-slate-200/60">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">FAQ</p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Questions, answered.
          </h2>
        </div>

        <div className="mt-10 divide-y divide-slate-200/80 rounded-2xl border border-slate-200/80 bg-white">
          {faqs.map((f) => (
            <details key={f.q} className="group px-5 py-4">
              <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
                {f.q}
                <svg className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── CTA ───────────────────────────────────────────────────────────── */

function Cta() {
  return (
    <section className="border-b border-slate-200/60 bg-slate-900 text-white">
      <div className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Ready to run your hostel without the paperwork?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-slate-300">
          Get started in minutes. 30 days free, no credit card required.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/signup?plan=trial"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 sm:w-auto"
          >
            Start free trial
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#pricing"
            className="inline-flex w-full items-center justify-center rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 sm:w-auto"
          >
            Compare plans
          </a>
        </div>
      </div>
    </section>
  )
}

/* ─── Footer ────────────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="bg-white">
      <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <span className="font-display text-sm font-bold">GH Hostels</span>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
          <Link href="/login" className="hover:text-slate-900">Sign in</Link>
          <a href="#features" className="hover:text-slate-900">Features</a>
          <a href="#pricing" className="hover:text-slate-900">Pricing</a>
          <a href="#faq" className="hover:text-slate-900">FAQ</a>
          <a href="mailto:hello@gh-hostels.com" className="hover:text-slate-900">Contact</a>
        </div>
        <p className="text-xs text-slate-400">
          © {new Date().getFullYear()} GH Hostels. Made in Ghana.
        </p>
      </div>
    </footer>
  )
}
