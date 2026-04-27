import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  BedDouble, TrendingUp, Shield, Zap, Check, ArrowRight,
  Building2, CreditCard, FileText, Users, Globe, Sparkles,
  ChevronDown, BarChart3, Bot, ChevronRight,
} from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { AuthErrorRedirect } from '@/components/auth/auth-error-redirect'

export const metadata: Metadata = {
  title: 'GH Hostels — The smarter way to run your hostel',
  description:
    'All-in-one hostel management. Bookings, payments, accounting, payroll — everything your hostel needs, unified.',
}

/* ──────────────────────────────────────────────────────────────────────────────
   RESEND-INSPIRED LANDING PAGE
   Pure black void · Frost borders · Serif hero · Multi-color accents
   ────────────────────────────────────────────────────────────────────────── */

const FROST = 'rgba(214,235,253,0.19)'
const FROST_ALT = 'rgba(217,237,254,0.145)'

const FEATURES = [
  {
    icon: BedDouble,
    title: 'Room & booking engine',
    desc: 'Gantt calendar, drag-to-extend stays, split payments, walk-in kiosk mode. From single rooms to 500-bed dormitories.',
    accent: '#3b9eff',
  },
  {
    icon: CreditCard,
    title: 'Payments & invoicing',
    desc: 'Auto-generate invoices, accept Paystack MoMo & card, track partial payments, and email receipts on the spot.',
    accent: '#22ff99',
  },
  {
    icon: BarChart3,
    title: 'Full accounting',
    desc: 'Double-entry ledger, chart of accounts, trial balance, P&L. GRA-compliant from day one — no spreadsheets needed.',
    accent: '#ff801f',
  },
  {
    icon: Users,
    title: 'Staff & payroll',
    desc: 'QR clock-in, shift scheduling, SSNIT/PAYE deductions, payslip generation. Manage your team from one screen.',
    accent: '#ffc53d',
  },
  {
    icon: Globe,
    title: 'Your brand, your domain',
    desc: 'Custom domain, your logo, your colors. Occupant and staff portals that feel like your own product.',
    accent: '#3b9eff',
  },
  {
    icon: Bot,
    title: 'AI assistant',
    desc: '"How many rooms are free this weekend?" Ask questions in plain English and get instant answers from your data.',
    accent: '#ff801f',
  },
]

const PLANS = [
  {
    name: 'Starter',
    price: '500',
    interval: '/month',
    desc: 'For hostels up to 50 rooms',
    features: ['Up to 50 rooms', 'Online bookings + Paystack MoMo/card', 'Invoices & receipts', 'Occupant portal'],
    cta: 'Subscribe',
    highlight: false,
  },
  {
    name: 'Growth',
    price: '800',
    interval: '/month',
    desc: 'For hostels up to 200 rooms',
    features: ['Up to 200 rooms', 'Staff payroll (GRA tax engine)', 'Full double-entry accounting', 'Portfolio view', 'Priority support'],
    cta: 'Subscribe',
    highlight: true,
  },
  {
    name: 'Pro',
    price: '1,000',
    interval: '/month',
    desc: 'Unlimited rooms, AI, SLA',
    features: ['Unlimited rooms', 'AI booking agent', 'Custom domain + branding', 'Anomaly detection', 'Dedicated SLA'],
    cta: 'Subscribe',
    highlight: false,
  },
]

const FAQS = [
  { q: 'How long is the free trial?', a: '30 days with full Growth plan features. No credit card required. Your data is preserved when you upgrade.' },
  { q: 'Can I use my own domain?', a: 'Yes. Add a custom domain like app.yourhostel.com in Settings. We handle SSL automatically.' },
  { q: 'Is my data secure?', a: 'All data is encrypted at rest and in transit. Each tenant is fully isolated with row-level security. Hosted on Supabase infrastructure.' },
  { q: 'Do you support MoMo payments?', a: 'Yes. We integrate with Paystack for Mobile Money (MTN, Vodafone, AirtelTigo), cards, and bank transfers.' },
  { q: 'Can I manage multiple hostels?', a: 'The Growth and Pro plans include a portfolio view that lets you manage multiple properties from a single dashboard.' },
  { q: 'What happens when my trial ends?', a: 'Your account stays accessible and your data is preserved. You just need to pick a plan to continue using the platform.' },
]

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const headersList = await headers()
  const host = headersList.get('host') ?? ''
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'gh-hostels.com'
  const rootDomain = appDomain.startsWith('app.') ? appDomain.slice(4) : appDomain
  const isAppDomain = host === rootDomain || host === `app.${rootDomain}` || host === `www.${rootDomain}` || host.includes('localhost')

  if (user && isAppDomain) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-black text-[#f0f0f0] selection:bg-white/20">
      {/* If Supabase bounced an expired/invalid auth link to the root, forward
         the hash to /auth/invite so the user gets a proper error UI. */}
      <AuthErrorRedirect />

      {/* ── NAVIGATION ──────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-50 backdrop-blur-xl"
        style={{ borderBottom: `1px solid ${FROST}` }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white">
              <svg viewBox="0 0 24 24" fill="none" className="h-4.5 w-4.5">
                <path d="M3 11L12 3l9 8" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="7" y="13" width="3.5" height="3.5" rx="0.5" fill="black"/>
                <rect x="13.5" y="13" width="3.5" height="3.5" rx="0.5" fill="black"/>
              </svg>
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-white">GH Hostels</span>
          </Link>

          {/* Nav links */}
          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-[14px] font-medium tracking-[0.35px] text-[#a1a4a5] transition-colors hover:text-white">Features</a>
            <a href="#pricing" className="text-[14px] font-medium tracking-[0.35px] text-[#a1a4a5] transition-colors hover:text-white">Pricing</a>
            <a href="#faq" className="text-[14px] font-medium tracking-[0.35px] text-[#a1a4a5] transition-colors hover:text-white">FAQ</a>
          </div>

          {/* CTA */}
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-[14px] font-medium text-[#a1a4a5] transition-colors hover:text-white"
            >
              Log in
            </Link>
            <Link
              href="/signup?plan=trial"
              className="hidden rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-black transition-all hover:bg-white/90 sm:inline-flex"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-[#3b9eff]/[0.04] blur-[120px]" />
          <div className="absolute right-0 top-1/4 h-[400px] w-[400px] rounded-full bg-[#ff801f]/[0.03] blur-[100px]" />
        </div>

        <div className="relative mx-auto max-w-5xl px-5 pb-16 pt-20 text-center sm:px-6 sm:pb-24 md:pt-36">
          {/* Announcement pill */}
          <div
            className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium text-[#a1a4a5] transition-colors hover:text-white sm:mb-10 sm:px-4 sm:py-1.5 sm:text-[12px]"
            style={{ border: `1px solid ${FROST}` }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#22ff99] animate-pulse" />
            Now accepting hostel owners across Ghana
            <ChevronRight className="h-3 w-3" />
          </div>

          {/* Hero headline — serif display */}
          <h1
            className="mx-auto max-w-4xl text-[36px] font-normal leading-[1.08] tracking-[-1px] text-white sm:text-[48px] md:text-[72px] lg:text-[96px]"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif', letterSpacing: '-0.96px' }}
          >
            The smarter way{' '}
            <span className="block">to run your <em className="not-italic text-[#a1a4a5]">hostel</em></span>
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mt-5 max-w-[520px] text-[15px] leading-relaxed text-[#a1a4a5] sm:mt-7 sm:text-[17px]">
            From bookings and payments to housekeeping and full GRA-compliant
            accounting — everything you need, elegantly unified.
          </p>

          {/* CTA buttons */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/signup?plan=trial"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-[14px] font-semibold text-black transition-all hover:bg-white/90 sm:w-auto"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#features"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[14px] font-medium text-[#f0f0f0] transition-all hover:bg-white/[0.08] sm:w-auto"
              style={{ border: `1px solid ${FROST}` }}
            >
              See features
            </a>
          </div>

          <p className="mt-5 text-[12px] text-[#464a4d]">
            No credit card required · 30-day free trial · Cancel anytime
          </p>

          {/* Dashboard mockup */}
          <div className="relative mx-auto mt-12 max-w-5xl sm:mt-20">
            {/* Glow */}
            <div className="absolute inset-0 -z-10 translate-y-8">
              <div className="mx-auto h-full w-full max-w-4xl rounded-3xl bg-gradient-to-b from-[#3b9eff]/[0.08] via-[#3b9eff]/[0.03] to-transparent blur-[80px]" />
            </div>
            {/* Frame */}
            <div
              className="overflow-hidden rounded-2xl shadow-2xl shadow-black/60"
              style={{ border: `1px solid ${FROST}` }}
            >
              {/* Browser chrome */}
              <div
                className="flex items-center gap-2 px-4 py-3"
                style={{ borderBottom: `1px solid ${FROST}`, background: 'rgba(255,255,255,0.02)' }}
              >
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
                  <div className="h-2.5 w-2.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
                  <div className="h-2.5 w-2.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
                </div>
                <div className="ml-4 flex-1 rounded-md py-1 px-3 text-[10px] text-[#464a4d] text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  app.abremponghostel.com/dashboard
                </div>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/dashboard-hero.jpg"
                alt="GH Hostels dashboard"
                className="w-full"
                loading="eager"
              />
            </div>
            {/* Fade */}
            <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black to-transparent" />
          </div>
        </div>
      </section>

      {/* ── TRUST BAR ────────────────────────────────────────────────── */}
      <section style={{ borderTop: `1px solid ${FROST}`, borderBottom: `1px solid ${FROST}` }}>
        <div className="mx-auto grid max-w-5xl grid-cols-2 divide-x divide-y md:grid-cols-4 md:divide-y-0" style={{ borderColor: FROST }}>
          {[
            { value: '500+', label: 'Hostels managed' },
            { value: 'GH₵ 2M+', label: 'Processed monthly' },
            { value: '99.9%', label: 'Uptime guarantee' },
            { value: 'GRA-ready', label: 'Tax compliance' },
          ].map((s, i) => (
            <div
              key={s.label}
              className="px-4 py-5 text-center sm:px-6 sm:py-8"
              style={{ borderColor: FROST }}
            >
              <p className="text-[20px] font-bold text-white tracking-tight sm:text-[28px]">{s.value}</p>
              <p className="mt-1 text-[11px] text-[#464a4d] sm:text-[13px]">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────── */}
      <section id="features" className="py-16 sm:py-28">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center">
            <p className="text-[12px] font-medium uppercase tracking-widest text-[#a1a4a5]">Features</p>
            <h2
              className="mt-4 text-[28px] font-normal leading-[1.15] tracking-[-0.5px] text-white sm:text-[36px] md:text-[56px]"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            >
              Everything your hostel needs
            </h2>
            <p className="mx-auto mt-4 max-w-[440px] text-[14px] text-[#a1a4a5] sm:mt-5 sm:text-[16px]">
              One login. No spreadsheets. No third-party tools. Just a system that works.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:mt-16 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon
              return (
                <div
                  key={f.title}
                  className="group rounded-2xl p-5 transition-colors hover:bg-white/[0.02] sm:p-6"
                  style={{ border: `1px solid ${FROST_ALT}` }}
                >
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ background: `${f.accent}18` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: f.accent }} strokeWidth={1.5} />
                  </div>
                  <h3 className="mt-5 text-[16px] font-semibold text-white">{f.title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-[#a1a4a5]">{f.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────────────── */}
      <section id="pricing" className="py-16 sm:py-28" style={{ borderTop: `1px solid ${FROST}` }}>
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center">
            <p className="text-[12px] font-medium uppercase tracking-widest text-[#a1a4a5]">Pricing</p>
            <h2
              className="mt-4 text-[28px] font-normal leading-[1.15] tracking-[-0.5px] text-white sm:text-[36px] md:text-[56px]"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            >
              Simple, transparent pricing
            </h2>
            <p className="mx-auto mt-4 max-w-[420px] text-[14px] text-[#a1a4a5] sm:mt-5 sm:text-[16px]">
              Start free. Pick a plan when you&apos;re ready.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:mt-16 sm:gap-5 md:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-2xl p-5 sm:p-7 ${plan.highlight ? 'bg-white/[0.03]' : ''}`}
                style={{ border: `1px solid ${plan.highlight ? 'rgba(59,158,255,0.3)' : FROST_ALT}` }}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#3b9eff] px-3 py-0.5 text-[11px] font-semibold text-white">
                    Most popular
                  </span>
                )}
                <p className="text-[14px] font-semibold text-white">{plan.name}</p>
                <p className="mt-1 text-[13px] text-[#464a4d]">{plan.desc}</p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-[13px] text-[#464a4d]">GH₵</span>
                  <span className="text-[32px] font-bold tracking-tight text-white sm:text-[40px]">{plan.price}</span>
                  <span className="text-[14px] text-[#464a4d]">{plan.interval}</span>
                </div>
                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[14px] text-[#a1a4a5]">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#22ff99]" strokeWidth={2} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/signup?plan=${plan.name.toLowerCase()}`}
                  className={`mt-7 block rounded-full py-3 text-center text-[14px] font-semibold transition-all ${
                    plan.highlight
                      ? 'bg-white text-black hover:bg-white/90'
                      : 'text-white hover:bg-white/[0.08]'
                  }`}
                  style={!plan.highlight ? { border: `1px solid ${FROST}` } : undefined}
                >
                  {plan.cta}
                  <ArrowRight className="ml-1.5 inline h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </div>

          {/* Trial nudge */}
          <div
            className="mx-auto mt-8 flex max-w-xl flex-col items-center justify-between gap-4 rounded-2xl p-5 sm:mt-10 sm:flex-row sm:p-6"
            style={{ border: `1px solid ${FROST}` }}
          >
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-[#ffc53d]" />
              <div>
                <p className="text-[14px] font-semibold text-white">Not ready to commit?</p>
                <p className="text-[13px] text-[#464a4d]">Start a 30-day free trial. All Growth features, no card.</p>
              </div>
            </div>
            <Link
              href="/signup?plan=trial"
              className="w-full shrink-0 rounded-full bg-white px-5 py-2.5 text-center text-[13px] font-semibold text-black transition-all hover:bg-white/90 sm:w-auto"
            >
              Start free trial <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────── */}
      <section id="faq" className="py-16 sm:py-28" style={{ borderTop: `1px solid ${FROST}` }}>
        <div className="mx-auto max-w-2xl px-5 sm:px-6">
          <div className="text-center">
            <p className="text-[12px] font-medium uppercase tracking-widest text-[#a1a4a5]">FAQ</p>
            <h2
              className="mt-4 text-[28px] font-normal leading-[1.15] tracking-[-0.5px] text-white sm:text-[36px] md:text-[48px]"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            >
              Questions & answers
            </h2>
          </div>

          <div className="mt-10 space-y-0 divide-y sm:mt-14" style={{ borderColor: FROST_ALT }}>
            {FAQS.map((faq) => (
              <details key={faq.q} className="group py-5" style={{ borderColor: FROST_ALT }}>
                <summary className="flex cursor-pointer items-center justify-between text-[14px] font-medium text-white transition-colors hover:text-white/80 sm:text-[15px] [&::-webkit-details-marker]:hidden">
                  {faq.q}
                  <ChevronDown className="h-4 w-4 shrink-0 text-[#464a4d] transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 pr-8 text-[14px] leading-relaxed text-[#a1a4a5]">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────── */}
      <section className="relative py-16 sm:py-28" style={{ borderTop: `1px solid ${FROST}` }}>
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#3b9eff]/[0.04] blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-2xl px-6 text-center">
          <h2
            className="text-[28px] font-normal leading-[1.15] tracking-[-0.5px] text-white sm:text-[36px] md:text-[56px]"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            Ready to modernize{' '}
            <span className="block">your hostel?</span>
          </h2>
          <p className="mx-auto mt-4 max-w-[380px] text-[14px] text-[#a1a4a5] sm:mt-5 sm:text-[16px]">
            Join hundreds of hostel owners who&apos;ve switched to GH Hostels.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/signup?plan=trial"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-[14px] font-semibold text-black transition-all hover:bg-white/90 sm:w-auto"
            >
              Start free trial
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#pricing"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[14px] font-medium text-[#f0f0f0] transition-all hover:bg-white/[0.08] sm:w-auto"
              style={{ border: `1px solid ${FROST}` }}
            >
              See pricing
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────── */}
      <footer className="py-10" style={{ borderTop: `1px solid ${FROST}` }}>
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <p className="text-[12px] text-[#464a4d]">
            © {new Date().getFullYear()} GH Hostels. All rights reserved.
          </p>
          <div className="flex gap-6 text-[12px] text-[#464a4d]">
            <a href="#" className="transition-colors hover:text-white">Privacy</a>
            <a href="#" className="transition-colors hover:text-white">Terms</a>
            <a href="mailto:support@gh-hostels.com" className="transition-colors hover:text-white">Support</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
