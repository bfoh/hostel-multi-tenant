/**
 * Platform SaaS plans — what hostel owners pay GH Hostels.
 *
 * Each (tier × billing interval) maps to its own Paystack Plan (create once via
 * the admin bootstrap endpoint, then paste the returned plan codes into the env
 * vars below). Paystack subscriptions bind to a Plan, and the Plan carries both
 * the billing interval and the amount — so longer commitments (with discounts)
 * are modelled as separate Plans.
 *
 * Amounts are in pesewas (GHS × 100).
 *
 * Discounts (applied to the undiscounted monthly × number of months):
 *   monthly    0%
 *   quarterly  5%
 *   6 months  10%
 *   yearly    15%
 */

export type BusinessType = 'hostel' | 'hotel'
export type PlatformPlanName = 'starter' | 'growth' | 'hotel_starter' | 'hotel_growth'
export type BillingInterval = 'monthly' | 'quarterly' | 'biannual' | 'annual'

export interface IntervalDef {
  id:               BillingInterval
  label:            string
  months:           number
  discount:         number // 0–1
  paystackInterval: 'monthly' | 'quarterly' | 'biannually' | 'annually'
  envSuffix:        string
}

export const BILLING_INTERVALS: IntervalDef[] = [
  { id: 'monthly',   label: 'Monthly',   months: 1,  discount: 0,    paystackInterval: 'monthly',    envSuffix: 'MONTHLY' },
  { id: 'quarterly', label: 'Quarterly', months: 3,  discount: 0.05, paystackInterval: 'quarterly',  envSuffix: 'QUARTERLY' },
  { id: 'biannual',  label: '6 months',  months: 6,  discount: 0.1,  paystackInterval: 'biannually', envSuffix: 'BIANNUAL' },
  { id: 'annual',    label: 'Yearly',    months: 12, discount: 0.15, paystackInterval: 'annually',   envSuffix: 'ANNUAL' },
]

export function getInterval(id: BillingInterval): IntervalDef {
  return BILLING_INTERVALS.find((i) => i.id === id) ?? BILLING_INTERVALS[0]
}

interface PlanDef {
  name:               PlatformPlanName
  businessType:       BusinessType
  displayName:        string
  description:        string
  baseMonthlyPesewas: number
  features:           string[]
}

/**
 * Hotel prices (baseMonthlyPesewas) are placeholders — approved 2026-09-25
 * pending real Ghana hotel-market pricing data. Update in place here (and
 * re-run the admin bootstrap-plans endpoint) once real numbers land; nothing
 * else needs to change since every consumer reads through this table.
 */
const PLAN_DEFS: PlanDef[] = [
  {
    name:               'starter',
    businessType:       'hostel',
    displayName:        'Starter',
    description:        'Up to 50 rooms. Core booking, invoicing, payments.',
    baseMonthlyPesewas: 80_000, // GHS 800 / month
    features: [
      'Up to 50 rooms',
      'Online bookings + Paystack MoMo/card',
      'Invoices & receipts',
      'Occupant portal',
    ],
  },
  {
    name:               'growth',
    businessType:       'hostel',
    displayName:        'Growth',
    description:        'Unlimited rooms. Adds HR, payroll, and multi-property.',
    baseMonthlyPesewas: 100_000, // GHS 1,000 / month
    features: [
      'Unlimited rooms',
      'Staff payroll (GRA tax engine)',
      'Full double-entry accounting',
      'Portfolio view',
      'Priority support',
    ],
  },
  {
    name:               'hotel_starter',
    businessType:       'hotel',
    displayName:        'Hotel Starter',
    description:        'Up to 20 rooms. Reservations, invoicing, payments.',
    baseMonthlyPesewas: 120_000, // GHS 1,200 / month — PLACEHOLDER
    features: [
      'Up to 20 rooms',
      'Online bookings + Paystack MoMo/card',
      'Invoices & receipts',
      'Guest self-service portal',
    ],
  },
  {
    name:               'hotel_growth',
    businessType:       'hotel',
    displayName:        'Hotel Growth',
    description:        'Unlimited rooms. Adds HR, payroll, and multi-property.',
    baseMonthlyPesewas: 160_000, // GHS 1,600 / month — PLACEHOLDER
    features: [
      'Unlimited rooms',
      'Staff payroll (GRA tax engine)',
      'Full double-entry accounting',
      'Portfolio view',
      'Priority support',
    ],
  },
]

/** A fully-resolved plan for one (tier × interval). */
export interface PlatformPlan {
  name:               PlatformPlanName
  businessType:       BusinessType
  displayName:        string
  description:        string
  features:           string[]
  interval:           BillingInterval
  intervalLabel:      string
  paystackInterval:   IntervalDef['paystackInterval']
  months:             number
  discountPercent:    number  // 0, 5, 10, 15
  baseMonthlyPesewas: number  // undiscounted per-month
  monthlyPesewas:     number  // discounted per-month (for display)
  amountPesewas:      number  // total charged each cycle
  planCodeEnv:        string
  planCode:           string | null
}

function envName(tier: PlatformPlanName, suffix: string): string {
  return `PAYSTACK_PLAN_${tier.toUpperCase()}_${suffix}`
}

/**
 * Resolve the Paystack plan code from env. For the monthly interval we also
 * accept the legacy single-interval vars (PAYSTACK_PLAN_STARTER / _GROWTH) so
 * existing deployments keep working until the new vars are set.
 */
function resolvePlanCode(tier: PlatformPlanName, iv: IntervalDef): string | null {
  const primary = process.env[envName(tier, iv.envSuffix)]
  if (primary) return primary
  if (iv.id === 'monthly') {
    return process.env[`PAYSTACK_PLAN_${tier.toUpperCase()}`] ?? null
  }
  return null
}

function buildPlan(def: PlanDef, iv: IntervalDef): PlatformPlan {
  const amountPesewas  = Math.round(def.baseMonthlyPesewas * iv.months * (1 - iv.discount))
  const monthlyPesewas = Math.round(def.baseMonthlyPesewas * (1 - iv.discount))
  return {
    name:               def.name,
    businessType:       def.businessType,
    displayName:        def.displayName,
    description:        def.description,
    features:           def.features,
    interval:           iv.id,
    intervalLabel:      iv.label,
    paystackInterval:   iv.paystackInterval,
    months:             iv.months,
    discountPercent:    Math.round(iv.discount * 100),
    baseMonthlyPesewas: def.baseMonthlyPesewas,
    monthlyPesewas,
    amountPesewas,
    planCodeEnv:        envName(def.name, iv.envSuffix),
    planCode:           resolvePlanCode(def.name, iv),
  }
}

/**
 * One resolved plan per tier, at the given interval (default monthly),
 * scoped to one vertical. Defaults to 'hostel' — every caller today predates
 * the hotel vertical's plan catalog, so this preserves exactly today's
 * behavior (2 plans) until a caller explicitly passes 'hotel'.
 */
export function listPlatformPlans(
  interval: BillingInterval = 'monthly',
  businessType: BusinessType = 'hostel',
): PlatformPlan[] {
  const iv = getInterval(interval)
  return PLAN_DEFS.filter((def) => def.businessType === businessType).map((def) => buildPlan(def, iv))
}

/**
 * Every (tier × interval) variant — used by the bootstrap endpoint, which
 * needs to create every plan on Paystack regardless of vertical. Pass a
 * businessType to scope to one vertical instead.
 */
export function listAllPlanVariants(businessType?: BusinessType): PlatformPlan[] {
  return PLAN_DEFS
    .filter((def) => !businessType || def.businessType === businessType)
    .flatMap((def) => BILLING_INTERVALS.map((iv) => buildPlan(def, iv)))
}

export function getPlatformPlan(
  name: PlatformPlanName,
  interval: BillingInterval = 'monthly',
): PlatformPlan | null {
  const def = PLAN_DEFS.find((p) => p.name === name)
  if (!def) return null
  return buildPlan(def, getInterval(interval))
}

export function findPlanByCode(planCode: string): PlatformPlan | null {
  return listAllPlanVariants().find((p) => p.planCode === planCode) ?? null
}
