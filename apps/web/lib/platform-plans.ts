/**
 * Platform SaaS plans — what hostel owners pay GH Hostels each month.
 *
 * Each plan maps to a Paystack Plan (create once via the admin bootstrap
 * endpoint, then paste the returned plan code into the env vars below).
 * Amounts are in pesewas (GHS × 100).
 */

export type PlatformPlanName = 'starter' | 'growth' | 'pro'

export interface PlatformPlan {
  name:           PlatformPlanName
  displayName:    string
  description:    string
  amountPesewas:  number
  planCodeEnv:    string
  planCode:       string | null   // resolved from env at read time
  features:       string[]
}

const PLAN_DEFS: Omit<PlatformPlan, 'planCode'>[] = [
  {
    name:          'starter',
    displayName:   'Starter',
    description:   'Up to 50 rooms. Core booking, invoicing, payments.',
    amountPesewas: 50_000,                   // GHS 500 / month
    planCodeEnv:   'PAYSTACK_PLAN_STARTER',
    features: [
      'Up to 50 rooms',
      'Online bookings + Paystack MoMo/card',
      'Invoices & receipts',
      'Occupant portal',
    ],
  },
  {
    name:          'growth',
    displayName:   'Growth',
    description:   'Up to 200 rooms. Adds HR, payroll, and multi-property.',
    amountPesewas: 80_000,                   // GHS 800 / month
    planCodeEnv:   'PAYSTACK_PLAN_GROWTH',
    features: [
      'Up to 200 rooms',
      'Staff payroll (GRA tax engine)',
      'Full double-entry accounting',
      'Portfolio view',
      'Priority support',
    ],
  },
  {
    name:          'pro',
    displayName:   'Pro',
    description:   'Unlimited rooms. AI agent, custom domains, SLA.',
    amountPesewas: 100_000,                  // GHS 1,000 / month
    planCodeEnv:   'PAYSTACK_PLAN_PRO',
    features: [
      'Unlimited rooms',
      'AI booking agent',
      'Custom domain + branding',
      'Anomaly detection',
      'Dedicated SLA',
    ],
  },
]

export function listPlatformPlans(): PlatformPlan[] {
  return PLAN_DEFS.map((p) => ({
    ...p,
    planCode: process.env[p.planCodeEnv] ?? null,
  }))
}

export function getPlatformPlan(name: PlatformPlanName): PlatformPlan | null {
  const def = PLAN_DEFS.find((p) => p.name === name)
  if (!def) return null
  return { ...def, planCode: process.env[def.planCodeEnv] ?? null }
}

export function findPlanByCode(planCode: string): PlatformPlan | null {
  return listPlatformPlans().find((p) => p.planCode === planCode) ?? null
}
