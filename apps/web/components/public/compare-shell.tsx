import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Check, X, ChevronRight } from 'lucide-react'

import { PlatformFX } from '@/components/public/platform-fx'

const FOREST_DEEP = '#0A3729'
const GOLD = '#D4A24C'
const GOLD_SOFT = '#F5C26B'
const GOLD_DEEP = '#B8842E'
const IVORY = '#F5E9D2'
const INK = '#0A0A08'

const HAIR = 'rgba(245, 233, 210, 0.10)'
const HAIR_STRONG = 'rgba(245, 233, 210, 0.18)'

export type CompareValue = boolean | 'manual' | 'partial' | 'addon' | string

export type CompareRow = {
  capability: string
  competitor: CompareValue
  gh: CompareValue
  detail?: string
}

export type CompareShellProps = {
  competitorName: string
  competitorTagline: string
  pageEyebrow: string
  pageHeadline: React.ReactNode
  pageSub: string
  ctaLabel?: string
  intro: React.ReactNode
  rows: CompareRow[]
  reasons: { title: string; body: string }[]
  faqs: { q: string; a: string }[]
  bottomLine: React.ReactNode
  jsonLd?: object
}

export function CompareShell(props: CompareShellProps) {
  const {
    competitorName,
    competitorTagline,
    pageEyebrow,
    pageHeadline,
    pageSub,
    ctaLabel = 'Start 30-day free trial',
    intro,
    rows,
    reasons,
    faqs,
    bottomLine,
    jsonLd,
  } = props

  return (
    <div
      className="min-h-screen text-[#f5e9d2] selection:bg-[#D4A24C]/40 antialiased"
      style={{ background: INK }}
    >
      <PlatformFX />

      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      {/* NAV */}
      <nav
        className="sticky top-0 z-50 backdrop-blur-2xl"
        style={{ background: 'rgba(10,10,8,0.72)', borderBottom: `1px solid ${HAIR}` }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <Link href="/" className="group flex items-center gap-2.5">
            <Image
              src="/logo-mark.svg"
              alt="GH-HOSTELS"
              width={36}
              height={36}
              className="h-9 w-9 transition-transform duration-500 group-hover:rotate-[6deg]"
              priority
            />
            <span
              className="text-[15px] font-bold tracking-[0.16em]"
              style={{ color: IVORY, fontFamily: 'Plus Jakarta Sans, Inter, sans-serif' }}
            >
              GH-HOSTELS
            </span>
          </Link>

          <div className="hidden items-center gap-9 md:flex">
            {[
              { label: 'Features', href: '/#features' },
              { label: 'Locations', href: '/#locations' },
              { label: 'Pricing', href: '/#pricing' },
              { label: 'FAQ', href: '/#faq' },
            ].map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className="text-[13px] font-medium tracking-[0.08em] uppercase text-[#a8a89e] transition-colors duration-300 hover:text-[#F5E9D2]"
              >
                {l.label}
              </Link>
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
              {ctaLabel}
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 platform-mesh" aria-hidden="true" />

        <div className="relative mx-auto max-w-4xl px-5 pb-20 pt-20 text-center sm:px-6 sm:pb-24 md:pt-32">
          <div
            className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em]"
            style={{
              border: `1px solid ${HAIR_STRONG}`,
              background: 'rgba(15,76,58,0.35)',
              color: IVORY,
            }}
            data-platform-reveal
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: GOLD_SOFT }}
            />
            {pageEyebrow}
            <ChevronRight className="h-3 w-3" />
          </div>

          <h1
            className="mx-auto max-w-3xl text-[36px] font-normal leading-[1.06] tracking-[-1.2px] sm:text-[54px] md:text-[72px]"
            style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              color: IVORY,
              letterSpacing: '-0.04em',
            }}
            data-platform-reveal
          >
            {pageHeadline}
          </h1>

          <p
            className="mx-auto mt-7 max-w-[640px] text-[16px] leading-relaxed sm:text-[18px]"
            style={{ color: 'rgba(245,233,210,0.65)' }}
            data-platform-reveal
            data-platform-reveal-delay="120"
          >
            {pageSub}
          </p>

          <div
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
            data-platform-reveal
            data-platform-reveal-delay="220"
          >
            <Link
              href="/signup?plan=trial"
              data-platform-magnetic
              className="platform-cta group inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[14px] font-semibold"
              style={{
                background: `linear-gradient(135deg, ${GOLD_SOFT} 0%, ${GOLD} 50%, ${GOLD_DEEP} 100%)`,
                color: FOREST_DEEP,
                boxShadow: '0 12px 32px -10px rgba(212,162,76,0.55)',
              }}
            >
              {ctaLabel}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/#pricing"
              className="inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[14px] font-medium transition-colors duration-300 hover:bg-[#F5E9D2]/10"
              style={{ border: `1px solid ${HAIR_STRONG}`, color: IVORY }}
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>

      {/* INTRO */}
      <section
        className="py-16 sm:py-24"
        style={{ borderTop: `1px solid ${HAIR}` }}
      >
        <div className="mx-auto max-w-3xl px-6">
          <div
            className="prose prose-lg max-w-none"
            style={{ color: 'rgba(245,233,210,0.78)' }}
            data-platform-reveal
          >
            {intro}
          </div>
        </div>
      </section>

      {/* COMPARISON TABLE */}
      <section
        id="compare"
        className="py-16 sm:py-24"
        style={{
          borderTop: `1px solid ${HAIR}`,
          background: 'rgba(15,76,58,0.10)',
        }}
      >
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center" data-platform-reveal>
            <p
              className="text-[11px] font-medium uppercase tracking-[0.24em]"
              style={{ color: GOLD }}
            >
              Feature-by-feature
            </p>
            <h2
              className="mt-5 text-[32px] font-normal leading-[1.1] tracking-[-0.04em] sm:text-[42px] md:text-[52px]"
              style={{ fontFamily: 'Georgia, serif', color: IVORY }}
            >
              GH Hostels vs {competitorName}
            </h2>
            <p
              className="mx-auto mt-4 max-w-[480px] text-[14px] sm:text-[16px]"
              style={{ color: 'rgba(245,233,210,0.55)' }}
            >
              {competitorTagline}
            </p>
          </div>

          <div
            className="mt-12 overflow-hidden rounded-2xl"
            style={{ border: `1px solid ${HAIR_STRONG}` }}
            data-platform-reveal
          >
            <div
              className="grid grid-cols-[2fr_1fr_1fr] items-center gap-1 px-5 py-4 text-[12px] font-medium uppercase tracking-[0.14em]"
              style={{
                background: 'rgba(245,233,210,0.04)',
                color: 'rgba(245,233,210,0.55)',
                borderBottom: `1px solid ${HAIR}`,
              }}
            >
              <div className="text-left">Capability</div>
              <div className="text-center">{competitorName}</div>
              <div
                className="text-center inline-flex items-center justify-center gap-1.5"
                style={{ color: GOLD }}
              >
                GH Hostels
              </div>
            </div>

            {rows.map((row, i) => (
              <div
                key={row.capability}
                className="grid grid-cols-[2fr_1fr_1fr] items-start gap-1 px-5 py-4 text-[14px]"
                style={{
                  background: i % 2 ? 'rgba(245,233,210,0.015)' : 'transparent',
                  color: IVORY,
                  borderBottom: i === rows.length - 1 ? 'none' : `1px solid ${HAIR}`,
                }}
              >
                <div>
                  <p style={{ color: 'rgba(245,233,210,0.85)', fontWeight: 500 }}>
                    {row.capability}
                  </p>
                  {row.detail && (
                    <p
                      className="mt-1 text-[13px] leading-relaxed"
                      style={{ color: 'rgba(245,233,210,0.45)' }}
                    >
                      {row.detail}
                    </p>
                  )}
                </div>
                <Cell value={row.competitor} />
                <Cell value={row.gh} highlight />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* REASONS */}
      <section className="py-16 sm:py-24" style={{ borderTop: `1px solid ${HAIR}` }}>
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center" data-platform-reveal>
            <p
              className="text-[11px] font-medium uppercase tracking-[0.24em]"
              style={{ color: GOLD }}
            >
              Why hostels switch
            </p>
            <h2
              className="mt-5 text-[32px] font-normal leading-[1.1] tracking-[-0.04em] sm:text-[42px]"
              style={{ fontFamily: 'Georgia, serif', color: IVORY }}
            >
              Five reasons we win in Ghana.
            </h2>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {reasons.map((r, i) => (
              <div
                key={r.title}
                className="platform-glow-card rounded-2xl p-6"
                style={{
                  border: `1px solid ${HAIR_STRONG}`,
                  background:
                    'linear-gradient(180deg, rgba(245,233,210,0.025) 0%, rgba(245,233,210,0.005) 100%)',
                }}
                data-platform-reveal
                data-platform-reveal-delay={String(i * 70)}
              >
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-[14px] font-bold tabular-nums"
                  style={{
                    background: `${GOLD}22`,
                    color: GOLD_SOFT,
                    border: `1px solid ${GOLD}33`,
                    fontFamily: 'Plus Jakarta Sans, Inter, sans-serif',
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </div>
                <h3
                  className="mt-5 text-[17px] font-semibold tracking-tight"
                  style={{
                    color: IVORY,
                    fontFamily: 'Plus Jakarta Sans, Inter, sans-serif',
                  }}
                >
                  {r.title}
                </h3>
                <p
                  className="mt-2.5 text-[14px] leading-relaxed"
                  style={{ color: 'rgba(245,233,210,0.6)' }}
                >
                  {r.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section
        id="faq"
        className="py-16 sm:py-24"
        style={{ borderTop: `1px solid ${HAIR}` }}
      >
        <div className="mx-auto max-w-3xl px-6">
          <div className="text-center" data-platform-reveal>
            <p
              className="text-[11px] font-medium uppercase tracking-[0.24em]"
              style={{ color: GOLD }}
            >
              FAQ
            </p>
            <h2
              className="mt-5 text-[32px] font-normal leading-[1.1] tracking-[-0.04em] sm:text-[40px]"
              style={{ fontFamily: 'Georgia, serif', color: IVORY }}
            >
              {competitorName} questions, answered.
            </h2>
          </div>

          <div className="mt-12 divide-y" style={{ borderColor: HAIR }}>
            {faqs.map((faq, i) => (
              <details
                key={faq.q}
                className="group py-5"
                style={{ borderColor: HAIR }}
                data-platform-reveal
                data-platform-reveal-delay={String(i * 30)}
              >
                <summary
                  className="flex cursor-pointer items-center justify-between text-[15px] font-medium [&::-webkit-details-marker]:hidden"
                  style={{ color: IVORY }}
                >
                  {faq.q}
                  <span
                    className="h-4 w-4 shrink-0 transition-transform duration-300 group-open:rotate-45"
                    style={{ color: GOLD }}
                  >
                    +
                  </span>
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

      {/* BOTTOM CTA */}
      <section
        className="relative overflow-hidden py-20 sm:py-28"
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
          />
          <h2
            className="mt-8 text-[34px] font-normal leading-[1.05] tracking-[-0.04em] sm:text-[44px] md:text-[56px]"
            style={{ fontFamily: 'Georgia, serif', color: IVORY }}
            data-platform-reveal
          >
            {bottomLine}
          </h2>
          <div
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
            data-platform-reveal
            data-platform-reveal-delay="100"
          >
            <Link
              href="/signup?plan=trial"
              data-platform-magnetic
              className="platform-cta inline-flex items-center justify-center gap-2 rounded-full px-8 py-4 text-[14px] font-semibold"
              style={{
                background: `linear-gradient(135deg, ${GOLD_SOFT} 0%, ${GOLD} 50%, ${GOLD_DEEP} 100%)`,
                color: FOREST_DEEP,
                boxShadow: '0 18px 42px -12px rgba(212,162,76,0.6)',
              }}
            >
              {ctaLabel} <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="mailto:sales@gh-hostels.com"
              className="inline-flex items-center justify-center gap-2 rounded-full px-8 py-4 text-[14px] font-medium transition-colors duration-300 hover:bg-[#F5E9D2]/10"
              style={{ border: `1px solid ${HAIR_STRONG}`, color: IVORY }}
            >
              Talk to sales
            </a>
          </div>
          <p
            className="mt-5 text-[12px]"
            style={{ color: 'rgba(245,233,210,0.4)' }}
          >
            No credit card · 30-day free trial · Cancel anytime
          </p>
        </div>
      </section>

      {/* FOOTER (slim) */}
      <footer style={{ borderTop: `1px solid ${HAIR}` }}>
        <div
          className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 sm:flex-row"
        >
          <p className="text-[12px]" style={{ color: 'rgba(245,233,210,0.4)' }}>
            © {new Date().getFullYear()} GH Hostels. Made in Accra, Ghana. 🇬🇭
          </p>
          <div className="flex gap-6 text-[12px]" style={{ color: 'rgba(245,233,210,0.4)' }}>
            <Link href="/" className="transition-colors hover:text-[#F5E9D2]">
              Home
            </Link>
            <Link href="/#pricing" className="transition-colors hover:text-[#F5E9D2]">
              Pricing
            </Link>
            <a
              href="mailto:support@gh-hostels.com"
              className="transition-colors hover:text-[#F5E9D2]"
            >
              Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

function Cell({ value, highlight }: { value: CompareValue; highlight?: boolean }) {
  if (value === true) {
    return (
      <div className="text-center">
        <Check
          className="mx-auto h-5 w-5"
          style={{ color: highlight ? GOLD : 'rgba(245,233,210,0.65)' }}
          strokeWidth={3}
        />
      </div>
    )
  }
  if (value === false) {
    return (
      <div className="text-center">
        <X
          className="mx-auto h-5 w-5"
          style={{ color: 'rgba(245,233,210,0.25)' }}
          strokeWidth={2.5}
        />
      </div>
    )
  }
  if (value === 'manual' || value === 'partial' || value === 'addon') {
    const label =
      value === 'manual' ? 'Manual' : value === 'partial' ? 'Partial' : 'Add-on $'
    return (
      <div
        className="text-center text-[12px] uppercase tracking-[0.12em]"
        style={{ color: 'rgba(245,233,210,0.42)' }}
      >
        {label}
      </div>
    )
  }
  return (
    <div
      className="text-center text-[13px]"
      style={{ color: 'rgba(245,233,210,0.65)' }}
    >
      {value}
    </div>
  )
}
