import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createPlan } from '@/lib/paystack'
import { listAllPlanVariants } from '@/lib/platform-plans'

/**
 * POST /api/admin/paystack/bootstrap-plans
 *
 * One-time bootstrap: creates the GH Hostels subscription plans on the
 * platform Paystack merchant. Returns the generated plan codes — paste them
 * into env vars PAYSTACK_PLAN_STARTER / _GROWTH.
 *
 * Guarded by platform super-admin membership.
 *
 * Body (optional): { force?: boolean }
 *   force=true → ignore env codes and create fresh plans (used when plan
 *                amounts or metadata have changed and we want new Paystack
 *                records; old plans are orphaned, which is safe because
 *                nothing references them once env is updated).
 *   default    → idempotent: skip any plan whose env code is already set.
 */
export async function POST(req: Request) {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    return NextResponse.json({ error: 'PAYSTACK_SECRET_KEY is not set' }, { status: 503 })
  }

  // Platform super-admin guard. Accept either a cookie session (browser) or a
  // Bearer token (curl/CLI).
  let userId: string | null = null
  const authHeader = req.headers.get('authorization') ?? ''
  const token      = authHeader.replace(/^Bearer\s+/i, '')
  const supabase   = createAdminClient()

  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token)
    userId = user?.id ?? null
  } else {
    const cookieClient = await createClient()
    const { data: { user } } = await cookieClient.auth.getUser()
    userId = user?.id ?? null
  }

  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: admin } = await supabase
    .from('platform_admins')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (!admin) return NextResponse.json({ error: 'Platform admin only' }, { status: 403 })

  const body  = await req.json().catch(() => ({}))
  const force = body?.force === true

  const plans   = listAllPlanVariants()
  const results: Array<{
    name: string; interval: string; env: string; planCode: string; amount: number; created: boolean
  }> = []

  for (const plan of plans) {
    if (plan.planCode && !force) {
      results.push({
        name: plan.name, interval: plan.interval, env: plan.planCodeEnv,
        planCode: plan.planCode, amount: plan.amountPesewas, created: false,
      })
      continue
    }
    try {
      const stamp   = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
      const created = await createPlan({
        name:          `GH Hostels — ${plan.displayName} (${plan.intervalLabel})${force ? ` ${stamp}` : ''}`,
        amountPesewas: plan.amountPesewas,
        interval:      plan.paystackInterval,
        description:   `${plan.description} Billed ${plan.intervalLabel.toLowerCase()}${plan.discountPercent ? ` (${plan.discountPercent}% off)` : ''}.`,
        currency:      'GHS',
      })
      results.push({
        name: plan.name, interval: plan.interval, env: plan.planCodeEnv,
        planCode: created.plan_code, amount: created.amount, created: true,
      })
    } catch (err: any) {
      return NextResponse.json(
        { error: `Failed to create plan ${plan.name}/${plan.interval}: ${err.message}`, partial: results },
        { status: 502 },
      )
    }
  }

  // Convenient env block to paste straight into Vercel / .env
  const envBlock = results.map((r) => `${r.env}=${r.planCode}`).join('\n')

  return NextResponse.json({
    results,
    envBlock,
    force,
    note: force
      ? 'Force-recreated. Paste the env block into your environment and redeploy. Old plan codes on Paystack are now orphaned.'
      : 'Paste the env block into your environment (PAYSTACK_PLAN_<TIER>_<INTERVAL>) and redeploy.',
  })
}
