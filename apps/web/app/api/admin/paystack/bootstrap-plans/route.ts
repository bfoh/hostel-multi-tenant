import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createPlan } from '@/lib/paystack'
import { listPlatformPlans } from '@/lib/platform-plans'

/**
 * POST /api/admin/paystack/bootstrap-plans
 *
 * One-time bootstrap: creates the GH Hostels subscription plans on the
 * platform Paystack merchant. Returns the generated plan codes — paste them
 * into env vars PAYSTACK_PLAN_STARTER / _GROWTH / _PRO.
 *
 * Guarded by platform super-admin membership. Idempotent: skips any plan
 * whose code is already populated in env.
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

  const plans   = listPlatformPlans()
  const results: Array<{ name: string; planCode: string; amount: number; created: boolean }> = []

  for (const plan of plans) {
    if (plan.planCode) {
      results.push({ name: plan.name, planCode: plan.planCode, amount: plan.amountPesewas, created: false })
      continue
    }
    try {
      const created = await createPlan({
        name:          `GH Hostels — ${plan.displayName}`,
        amountPesewas: plan.amountPesewas,
        interval:      'monthly',
        description:   plan.description,
        currency:      'GHS',
      })
      results.push({ name: plan.name, planCode: created.plan_code, amount: created.amount, created: true })
    } catch (err: any) {
      return NextResponse.json({ error: `Failed to create plan ${plan.name}: ${err.message}` }, { status: 502 })
    }
  }

  return NextResponse.json({
    results,
    note: 'Paste the created plan codes into env vars PAYSTACK_PLAN_STARTER, PAYSTACK_PLAN_GROWTH, PAYSTACK_PLAN_PRO.',
  })
}
