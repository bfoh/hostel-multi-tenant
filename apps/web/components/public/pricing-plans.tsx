'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, ArrowRight } from 'lucide-react'

const FOREST_DEEP = '#0A3729'
const GOLD = '#D4A24C'
const GOLD_SOFT = '#F5C26B'
const GOLD_DEEP = '#B8842E'
const IVORY = '#F5E9D2'
const HAIR_STRONG = 'rgba(245, 233, 210, 0.18)'

export type Plan = {
  name: string
  price: string
  interval: string
  desc: string
  features: string[]
  cta: string
  highlight: boolean
}

type Period = {
  id: string
  label: string
  months: number
  discount: number // 0–1
}

const PERIODS: Period[] = [
  { id: 'monthly', label: 'Monthly', months: 1, discount: 0 },
  { id: 'quarterly', label: 'Quarterly', months: 3, discount: 0.05 },
  { id: 'biannual', label: '6 months', months: 6, discount: 0.1 },
  { id: 'annual', label: 'Yearly', months: 12, discount: 0.15 },
]

const fmt = (n: number) => n.toLocaleString('en-US')

export function PricingPlans({ plans }: { plans: Plan[] }) {
  const [periodId, setPeriodId] = useState('monthly')
  const period = PERIODS.find((p) => p.id === periodId) ?? PERIODS[0]

  return (
    <>
      {/* Billing-period toggle */}
      <div className="mt-12 flex justify-center" data-platform-reveal>
        <div
          className="inline-flex flex-wrap justify-center gap-1 rounded-full p-1"
          style={{ border: `1px solid ${HAIR_STRONG}`, background: 'rgba(245,233,210,0.03)' }}
          role="tablist"
          aria-label="Billing period"
        >
          {PERIODS.map((p) => {
            const active = p.id === period.id
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setPeriodId(p.id)}
                className="relative rounded-full px-4 py-2 text-[13px] font-semibold transition-all"
                style={
                  active
                    ? {
                        background: `linear-gradient(135deg, ${GOLD_SOFT} 0%, ${GOLD} 50%, ${GOLD_DEEP} 100%)`,
                        color: FOREST_DEEP,
                      }
                    : { color: 'rgba(245,233,210,0.65)' }
                }
              >
                {p.label}
                {p.discount > 0 && (
                  <span
                    className="ml-1.5 text-[10px] font-bold"
                    style={{ color: active ? FOREST_DEEP : GOLD }}
                  >
                    −{Math.round(p.discount * 100)}%
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-2 max-w-3xl mx-auto">
        {plans.map((plan, i) => {
          const base = Number(plan.price.replace(/[^0-9.]/g, ''))
          const monthly = Math.round(base * (1 - period.discount))
          const total = monthly * period.months
          const saved = base * period.months - total

          return (
            <div
              key={plan.name}
              className="platform-glow-card relative flex flex-col rounded-2xl p-7"
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
                  {fmt(monthly)}
                </span>
                <span className="text-[14px]" style={{ color: 'rgba(245,233,210,0.45)' }}>
                  /month
                </span>
              </div>
              {/* Billing detail */}
              <div className="mt-2 min-h-[20px] text-[12.5px]">
                {period.months > 1 ? (
                  <span style={{ color: 'rgba(245,233,210,0.55)' }}>
                    <span style={{ textDecoration: 'line-through', opacity: 0.55 }}>
                      GH₵{fmt(base * period.months)}
                    </span>{' '}
                    GH₵{fmt(total)} billed every {period.months} months ·{' '}
                    <span style={{ color: GOLD, fontWeight: 600 }}>save GH₵{fmt(saved)}</span>
                  </span>
                ) : (
                  <span style={{ color: 'rgba(245,233,210,0.45)' }}>Billed monthly</span>
                )}
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
                href={`/signup?plan=${plan.name.toLowerCase()}&billing=${period.id}`}
                className="platform-cta mt-8 block rounded-full py-3.5 text-center text-[14px] font-semibold transition-all"
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
          )
        })}
      </div>
    </>
  )
}
