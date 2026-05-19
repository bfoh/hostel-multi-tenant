/**
 * Look up a walk-in sale by its entry/pickup token.
 *
 * Used by counter staff to verify that a customer's code is valid before
 * granting access (gym, sports) or releasing items (laundry).
 *
 * For gym + sports we additionally check that the sale is within its
 * validity window (24h for gym day pass, the booked duration for sports).
 */
import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

const schema = z.object({ token: z.string().min(4).max(12) })

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 422 })
  }

  const code = parsed.data.token.trim().toUpperCase()
  const supabase = createAdminClient()

  const { data: point } = await supabase
    .from('revenue_points')
    .select('id, type')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!point) return NextResponse.json({ error: 'Revenue point not found' }, { status: 404 })

  const { data: sale } = await supabase
    .from('revenue_point_sales')
    .select('id, total_amount, description, sold_at, status, customer_name, duration_minutes, weight_kg, entry_token, revenue_point_id, payment_method')
    .eq('tenant_id', tenantId)
    .eq('revenue_point_id', id)
    .eq('entry_token', code)
    .maybeSingle()

  if (!sale) {
    return NextResponse.json({ valid: false, reason: 'Code not found' }, { status: 200 })
  }

  // Compute validity window per type
  const type = (point as any).type as string
  const soldAtMs = new Date((sale as any).sold_at).getTime()
  const nowMs    = Date.now()

  let valid = true
  let reason: string | null = null

  if (type === 'gym') {
    const windowMs = 24 * 3600 * 1000
    if (nowMs - soldAtMs > windowMs) {
      valid = false
      reason = 'Day pass expired (24h limit).'
    }
  } else if (type === 'sports') {
    const windowMs = ((sale as any).duration_minutes ?? 60) * 60 * 1000
    if (nowMs - soldAtMs > windowMs) {
      valid = false
      reason = 'Booking window has ended.'
    }
  } else if (type === 'laundry') {
    if ((sale as any).status === 'collected') {
      valid = false
      reason = 'Already collected.'
    }
  }

  return NextResponse.json({
    valid,
    reason,
    sale: {
      id:            (sale as any).id,
      total_amount:  (sale as any).total_amount,
      description:   (sale as any).description,
      sold_at:       (sale as any).sold_at,
      status:        (sale as any).status,
      customer_name: (sale as any).customer_name,
      weight_kg:     (sale as any).weight_kg,
      duration_minutes: (sale as any).duration_minutes,
      entry_token:   (sale as any).entry_token,
      payment_method: (sale as any).payment_method,
    },
  })
}
