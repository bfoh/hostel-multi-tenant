import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Cron sweep: cancel food orders that were placed online but never paid
 * within 30 minutes. Stops abandoned Paystack transactions cluttering the
 * kitchen queue.
 *
 * Schedule via Vercel cron in vercel.json:
 *   { "path": "/api/cron/food-orders-sweep", "schedule": "*\/5 * * * *" }
 *
 * Auth: Bearer token from CRON_SECRET env, matching Vercel's cron header.
 */
export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (expected && req.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin  = createAdminClient() as any
  const cutoff = new Date(Date.now() - 30 * 60_000).toISOString()
  const stamp  = new Date().toISOString()

  const { data, error } = await admin
    .from('food_orders')
    .update({
      status:           'cancelled',
      cancelled_at:     stamp,
      cancelled_reason: 'Payment not completed within 30 minutes',
    })
    .eq('status', 'placed')
    .eq('payment_method', 'online')
    .is('paid_at', null)
    .lt('placed_at', cutoff)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ swept: ((data ?? []) as any[]).length })
}

export async function GET(req: NextRequest) {
  return POST(req)
}
