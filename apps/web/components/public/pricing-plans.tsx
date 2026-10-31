'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'

export type Plan = {
  name: string
  /**
   * URL-safe plan identifier for /signup?plan=<slug> — must match a
   * PlatformPlanName in lib/platform-plans.ts. Kept separate from `name`
   * (the display heading) since name.toLowerCase() only happened to work
   * for hostel's single-word "Starter"/"Growth"; it breaks for multi-word
   * names like "Hotel Starter" (produces "hotel starter", not the actual
   * "hotel_starter" slug the backend expects).
   */
  slug: string
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

export function PricingPlans({
  plans,
  isHotel,
  lead,
}: {
  plans: Plan[]
  isHotel?: boolean
  /** A card shown before the plans in the same grid (the free trial). */
  lead?: ReactNode
}) {
  const [periodId, setPeriodId] = useState('monthly')
  const period = PERIODS.find((p) => p.id === periodId) ?? PERIODS[0]

  return (
    <>
      {/* Billing-period toggle. Plain pressed buttons: it changes the
          prices below rather than switching panels, so it isn't a tablist. */}
      <div
        className="mt-10 grid max-w-sm grid-cols-2 gap-1 rounded-lg border border-bd-ink/15 bg-white p-1 sm:inline-flex sm:max-w-none"
        role="group"
        aria-label="Billing period"
      >
        {PERIODS.map((p) => {
          const active = p.id === period.id
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={active}
              onClick={() => setPeriodId(p.id)}
              className={[
                'bd-focus min-h-[40px] whitespace-nowrap rounded-md px-3.5 text-[14px] font-semibold transition-colors',
                active ? 'bg-bd-ink text-white' : 'text-bd-slate hover:bg-bd-mist hover:text-bd-ink',
              ].join(' ')}
            >
              {p.label}
              {p.discount > 0 && (
                <span className={`ml-1.5 text-[12px] font-semibold ${active ? 'text-white/75' : 'text-bd-teal'}`}>
                  −{Math.round(p.discount * 100)}%
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className={`mt-8 grid gap-5 ${lead ? 'sm:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-2 lg:max-w-4xl'}`}>
        {lead}
        {plans.map((plan) => {
          const base = Number(plan.price.replace(/[^0-9.]/g, ''))
          const monthly = Math.round(base * (1 - period.discount))
          const total = monthly * period.months
          const saved = base * period.months - total

          return (
            <div
              key={plan.name}
              className={[
                'flex flex-col rounded-xl border bg-white p-6 sm:p-7',
                plan.highlight ? 'border-bd-teal ring-1 ring-bd-teal' : 'border-bd-ink/15',
              ].join(' ')}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[16px] font-semibold text-bd-ink">{plan.name}</h3>
                {plan.highlight && (
                  <span className="rounded-md bg-bd-teal/10 px-2 py-0.5 text-[12px] font-semibold text-bd-teal">
                    Recommended
                  </span>
                )}
              </div>
              <p className="mt-1 text-[14px] text-bd-slate">{plan.desc}</p>
              <p className="mt-6 flex items-baseline gap-1">
                <span className="text-[15px] font-medium text-bd-slate">GH₵</span>
                <span className="font-display text-[40px] font-bold leading-none tracking-tight tabular-nums text-bd-ink">
                  {fmt(monthly)}
                </span>
                <span className="text-[15px] text-bd-slate">/month</span>
              </p>
              <p className="mt-2 min-h-[40px] text-[13px] text-bd-slate">
                {period.months > 1 ? (
                  <>
                    <span className="line-through">GH₵{fmt(base * period.months)}</span>{' '}
                    GH₵{fmt(total)} billed every {period.months} months ·{' '}
                    <span className="font-semibold text-bd-teal">save GH₵{fmt(saved)}</span>
                  </>
                ) : (
                  'Billed monthly'
                )}
              </p>
              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[15px] text-bd-ink">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-bd-teal" strokeWidth={2.5} aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={`/signup?plan=${plan.slug}&billing=${period.id}${isHotel ? '&type=hotel' : ''}`}
                className={[
                  'bd-focus mt-8 inline-flex min-h-[48px] items-center justify-center rounded-lg px-5 text-[15px] font-semibold transition-colors',
                  plan.highlight
                    ? 'bg-bd-teal text-white hover:bg-bd-teal-900'
                    : 'border border-bd-ink/20 bg-white text-bd-ink hover:border-bd-ink/40',
                ].join(' ')}
              >
                {plan.cta}
                <span className="sr-only"> to {plan.name}</span>
              </Link>
            </div>
          )
        })}
      </div>
    </>
  )
}
