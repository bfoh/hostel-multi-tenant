import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'

import {
  BedDouble, TrendingUp, Shield, Zap, Check, ArrowRight,
  Building2, CreditCard, FileText, Users, Globe, Sparkles,
  ChevronDown, BarChart3, Bot,
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
    <div className="min-h-[100dvh] bg-[#09090b] text-zinc-100 antialiased selection:bg-cyan-500/20 selection:text-cyan-200">
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
    <header className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg shadow-cyan-500/20 transition-shadow group-hover:shadow-cyan-500/40">
            <svg viewBox="0 0 24 24" fill="none" className="h-4.5 w-4.5">
              <path d="M3 11L12 3l9 8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="5" y="11" width="14" height="10" rx="1" fill="white" opacity="0.2"/>
              <rect x="7" y="13" width="3.5" height="3.5" rx="0.5" fill="white"/>
              <rect x="13.5" y="13" width="3.5" height="3.5" rx="0.5" fill="white"/>
              <rect x="9.5" y="17" width="5" height="4" rx="0.5" fill="white"/>
            </svg>
          </div>
          <span className="text-[15px] font-bold tracking-tight text-white">GH Hostels</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {['Features', 'Pricing', 'FAQ'].map((label) => (
            <a
              key={label}
              href={`#${label.toLowerCase()}`}
              className="text-[13px] font-medium text-zinc-400 transition-colors hover:text-white"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden text-[13px] font-medium text-zinc-400 transition-colors hover:text-white sm:block">
            Sign in
          </Link>
          <Link
            href="/signup?plan=trial"
            className="group inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-[13px] font-semibold text-zinc-900 shadow-sm transition-all hover:bg-zinc-100 active:scale-[0.97]"
          >
            Start free trial
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </header>
  )
}

/* ─── Hero ──────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden pt-28 pb-0">
      {/* Background effects */}
      <div className="absolute inset-0 -z-10">
        {/* Cyan glow top-left */}
        <div className="absolute -top-24 -left-24 h-[500px] w-[500px] rounded-full bg-cyan-500/[0.07] blur-[120px]" />
        {/* Blue glow top-right */}
        <div className="absolute -top-24 -right-24 h-[400px] w-[400px] rounded-full bg-blue-600/[0.05] blur-[120px]" />
        {/* Grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgb(255 255 255) 1px, transparent 1px),' +
              'linear-gradient(to bottom, rgb(255 255 255) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(ellipse at center top, black 20%, transparent 70%)',
          }}
        />
      </div>

      <div className="mx-auto max-w-6xl px-6 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/[0.06] px-3.5 py-1.5 backdrop-blur-sm animate-[fadeInUp_0.6s_ease-out_both]">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-semibold tracking-wide text-cyan-300">
            Built for Ghana&apos;s hostels
          </span>
        </div>

        {/* Headline */}
        <h1 className="mt-7 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl animate-[fadeInUp_0.6s_ease-out_0.1s_both]">
          Run your hostel
          <br />
          <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-300 bg-clip-text text-transparent">
            like it&apos;s 2026.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mx-auto mt-6 max-w-[580px] text-base text-zinc-400 leading-relaxed sm:text-lg animate-[fadeInUp_0.6s_ease-out_0.2s_both]">
          Bookings, payments, housekeeping, staff payroll, and full accounting — one dashboard,
          priced in Ghana cedis, built for the way hostels here actually work.
        </p>

        {/* CTAs */}
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row animate-[fadeInUp_0.6s_ease-out_0.3s_both]">
          <Link
            href="/signup?plan=trial"
            className="group inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all hover:shadow-cyan-500/40 hover:brightness-110 active:scale-[0.97] sm:w-auto"
          >
            Start 30-day free trial
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a
            href="#pricing"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-zinc-700/80 bg-zinc-800/50 px-6 py-3.5 text-sm font-semibold text-zinc-300 transition-all hover:border-zinc-600 hover:text-white hover:bg-zinc-800 sm:w-auto"
          >
            See pricing
          </a>
        </div>

        <p className="mt-4 text-xs text-zinc-500 animate-[fadeInUp_0.6s_ease-out_0.4s_both]">
          No credit card required · Cancel anytime
        </p>

        {/* Dashboard mockup */}
        <div className="relative mt-16 animate-[fadeInUp_0.8s_ease-out_0.5s_both]">
          {/* Glow behind the image */}
          <div className="absolute inset-0 -z-10 translate-y-8">
            <div className="mx-auto h-full w-full max-w-4xl rounded-3xl bg-gradient-to-b from-cyan-500/20 via-blue-600/10 to-transparent blur-3xl" />
          </div>
          {/* Border frame */}
          <div className="mx-auto max-w-5xl overflow-hidden rounded-t-2xl border border-white/[0.08] bg-zinc-900/40 shadow-2xl shadow-black/40 backdrop-blur-sm">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 border-b border-white/[0.06] bg-zinc-900/60 px-4 py-3">
              <div className="flex gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
              </div>
              <div className="ml-4 flex-1 rounded-md bg-zinc-800/60 py-1 px-3 text-[10px] text-zinc-500 text-center">
                unity.gh-hostels.com/dashboard
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/dashboard-hero.jpg"
              alt="GH Hostels dashboard showing occupancy, revenue, bookings, and a Gantt chart calendar"
              className="w-full"
              loading="eager"
            />
          </div>
          {/* Bottom fade */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#09090b] to-transparent" />
        </div>
      </div>
    </section>
  )
}

/* ─── Trust bar ─────────────────────────────────────────────────────── */

function TrustBar() {
  const items = [
    { value: '500+',       label: 'Hostels managed'    },
    { value: 'GH₵ 2M+',   label: 'Monthly volume'     },
    { value: '99.9%',      label: 'Uptime'             },
    { value: 'GRA-ready',  label: 'Payroll tax engine'  },
  ]
  return (
    <section className="relative border-y border-white/[0.06]">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-6 py-10 md:grid-cols-4">
        {items.map((i) => (
          <div key={i.label} className="text-center">
            <p className="text-2xl font-bold tracking-tight text-white">{i.value}</p>
            <p className="mt-1 text-xs text-zinc-500">{i.label}</p>
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
      gradient: 'from-cyan-400/10 to-cyan-400/0',
      iconColor: 'text-cyan-400',
    },
    {
      icon:  CreditCard,
      title: 'Paystack payments',
      body:  'Mobile money, cards, bank transfer. Money lands in your Paystack account — we never hold it. Automated receipts.',
      gradient: 'from-emerald-400/10 to-emerald-400/0',
      iconColor: 'text-emerald-400',
    },
    {
      icon:  BarChart3,
      title: 'Double-entry accounting',
      body:  'Proper journals, ledgers, trial balance, and P&L. No more reconciliation headaches at term-end.',
      gradient: 'from-violet-400/10 to-violet-400/0',
      iconColor: 'text-violet-400',
    },
    {
      icon:  Users,
      title: 'Staff & payroll',
      body:  'SSNIT, PAYE, and GRA-compliant payslips. Manage staff roles, shifts, and leave from one place.',
      gradient: 'from-amber-400/10 to-amber-400/0',
      iconColor: 'text-amber-400',
    },
    {
      icon:  Shield,
      title: 'Occupant verification',
      body:  'Ghana Card upload, guarantor records, and digital lease tracking. Audit trail on every change.',
      gradient: 'from-rose-400/10 to-rose-400/0',
      iconColor: 'text-rose-400',
    },
    {
      icon:  Globe,
      title: 'Custom domain + branding',
      body:  'Your hostel, your colour, your logo, your URL. Guests see your brand — not ours.',
      gradient: 'from-blue-400/10 to-blue-400/0',
      iconColor: 'text-blue-400',
    },
  ]

  return (
    <section id="features" className="relative">
      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-cyan-500/[0.03] blur-[150px]" />

      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">Everything in one place</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            The whole back-office, one login.
          </h2>
          <p className="mt-4 text-zinc-400 leading-relaxed">
            Stop stitching together WhatsApp, Excel, and hand-written ledgers. GH Hostels
            covers the full lifecycle — from a prospective guest&apos;s first click to year-end books.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-zinc-900/40 p-6 transition-all duration-300 hover:border-white/[0.1] hover:bg-zinc-900/60"
            >
              {/* Hover gradient */}
              <div className={`absolute inset-0 bg-gradient-to-b ${f.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />

              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-zinc-800/60">
                  <f.icon className={`h-5 w-5 ${f.iconColor}`} strokeWidth={1.8} />
                </div>
                <h3 className="mt-4 text-[15px] font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{f.body}</p>
              </div>
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
    <section id="pricing" className="relative border-t border-white/[0.06]">
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[400px] w-[800px] rounded-full bg-blue-600/[0.04] blur-[120px]" />

      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">Pricing</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Simple plans. Cedi pricing. No setup fees.
          </h2>
          <p className="mt-4 text-zinc-400 leading-relaxed">
            Billed monthly via Paystack. Upgrade, downgrade, or cancel any time — access continues
            until the end of your paid period.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {plans.map((p) => {
            const isHighlight = highlight[p.name]
            return (
              <div
                key={p.name}
                className={[
                  'group relative flex flex-col overflow-hidden rounded-2xl border p-7 transition-all duration-300',
                  isHighlight
                    ? 'border-cyan-500/30 bg-gradient-to-b from-cyan-500/[0.06] to-zinc-900/40 shadow-lg shadow-cyan-500/5'
                    : 'border-white/[0.06] bg-zinc-900/40 hover:border-white/[0.1]',
                ].join(' ')}
              >
                {isHighlight && (
                  <div className="absolute -top-px left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
                )}
                {isHighlight && (
                  <div className="mb-5 inline-flex self-start items-center rounded-full bg-cyan-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-400 border border-cyan-400/20">
                    Most popular
                  </div>
                )}

                <h3 className="text-lg font-bold text-white">{p.displayName}</h3>
                <p className="mt-1 text-sm text-zinc-500">{p.description}</p>

                <div className="mt-5 flex items-baseline gap-1.5">
                  <span className="text-4xl font-extrabold tracking-tight text-white">
                    GH₵ {(p.amountPesewas / 100).toLocaleString()}
                  </span>
                  <span className="text-sm text-zinc-500">/ month</span>
                </div>

                <ul className="mt-7 space-y-3 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-300">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" strokeWidth={2.5} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={`/signup?plan=${p.name}`}
                  className={[
                    'mt-8 inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-sm font-semibold transition-all active:scale-[0.97]',
                    isHighlight
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 hover:brightness-110'
                      : 'border border-zinc-700/80 bg-zinc-800/60 text-zinc-200 hover:border-zinc-600 hover:bg-zinc-800 hover:text-white',
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
        <div className="mt-8 overflow-hidden rounded-2xl border border-white/[0.06] bg-zinc-900/40 px-6 py-5 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/[0.06]">
              <Sparkles className="h-5 w-5 text-amber-400" strokeWidth={1.8} />
            </div>
            <div>
              <p className="font-semibold text-white">Not ready to commit?</p>
              <p className="mt-0.5 text-sm text-zinc-400">
                Start a 30-day free trial. All Growth features, no card. Pick a plan whenever you&apos;re ready.
              </p>
            </div>
          </div>
          <Link
            href="/signup?plan=trial"
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-zinc-700/80 bg-zinc-800/60 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition-all hover:border-zinc-600 hover:bg-zinc-800 hover:text-white"
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
    <section id="faq" className="border-t border-white/[0.06]">
      <div className="mx-auto max-w-3xl px-6 py-24">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">FAQ</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Questions, answered.
          </h2>
        </div>

        <div className="mt-12 divide-y divide-white/[0.06] rounded-2xl border border-white/[0.06] bg-zinc-900/40">
          {faqs.map((f) => (
            <details key={f.q} className="group px-5 py-4">
              <summary className="flex cursor-pointer items-center justify-between gap-4 text-[15px] font-semibold text-zinc-200 [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">{f.a}</p>
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
    <section className="relative overflow-hidden border-t border-white/[0.06]">
      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-cyan-500/[0.06] blur-[150px]" />

      <div className="relative mx-auto max-w-4xl px-6 py-24 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Ready to run your hostel without the paperwork?
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-zinc-400 leading-relaxed">
          Get started in minutes. 30 days free, no credit card required.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/signup?plan=trial"
            className="group inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:shadow-cyan-500/40 hover:brightness-110 active:scale-[0.97] sm:w-auto"
          >
            Start free trial
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a
            href="#pricing"
            className="inline-flex w-full items-center justify-center rounded-xl border border-zinc-700/80 bg-zinc-800/50 px-6 py-3.5 text-sm font-semibold text-zinc-300 transition-all hover:border-zinc-600 hover:text-white hover:bg-zinc-800 sm:w-auto"
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
    <footer className="border-t border-white/[0.06]">
      <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600">
            <Building2 className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-bold text-white">GH Hostels</span>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-zinc-500">
          <Link href="/login" className="transition-colors hover:text-zinc-300">Sign in</Link>
          <a href="#features" className="transition-colors hover:text-zinc-300">Features</a>
          <a href="#pricing" className="transition-colors hover:text-zinc-300">Pricing</a>
          <a href="#faq" className="transition-colors hover:text-zinc-300">FAQ</a>
          <a href="mailto:hello@gh-hostels.com" className="transition-colors hover:text-zinc-300">Contact</a>
        </div>
        <p className="text-xs text-zinc-600">
          © {new Date().getFullYear()} GH Hostels. Made in Ghana.
        </p>
      </div>
    </footer>
  )
}
