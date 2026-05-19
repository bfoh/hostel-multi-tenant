/**
 * POS pay link — initialize a Paystack hosted-page transaction for an
 * in-person sale at a revenue point. The actual revenue_point_sales row
 * is written by the unified webhook on charge.success (source='pos_sale'),
 * keeping the existing journal trigger semantics intact (no pending sales
 * in the ledger).
 *
 * The cashier can display the returned `authorization_url` as a QR code
 * for the customer to scan and pay on their phone, then poll
 * `/api/revenue-points/sales/by-reference?reference=...` to confirm.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { z } from 'zod'
import { initializeTransaction } from '@/lib/paystack'

const schema = z.object({
  revenue_point_id: z.string().uuid(),
  item_id:          z.string().uuid().nullable().optional(),
  description:      z.string().min(1).max(200),
  quantity:         z.number().positive().optional(),
  unit_price:       z.number().int().positive().optional(),  // pesewas
  total_amount:     z.number().int().positive(),             // pesewas
  payment_method:   z.enum(['card', 'mobile_money', 'bank_transfer']),
  customer_name:    z.string().max(120).nullable().optional(),
  customer_email:   z.string().email().nullable().optional(),
  occupant_id:      z.string().uuid().nullable().optional(),
})

const CHANNEL_MAP: Record<string, ('card' | 'mobile_money' | 'bank' | 'bank_transfer')[]> = {
  card:           ['card'],
  mobile_money:   ['mobile_money'],
  bank_transfer:  ['bank', 'bank_transfer'],
}

export async function POST(req: NextRequest) {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    return NextResponse.json({ error: 'Paystack is not configured.' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const admin = createAdminClient()

  const { data: tenant } = await admin
    .from('tenants')
    .select('id, slug, name, paystack_subaccount_code')
    .eq('id', tenantId)
    .single()

  if (!tenant?.paystack_subaccount_code) {
    return NextResponse.json(
      { error: 'Connect a payout bank in Settings → Payouts first.' },
      { status: 409 },
    )
  }

  const host  = req.headers.get('host') ?? 'localhost:3000'
  const proto = host.includes('localhost') ? 'http' : 'https'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`
  const reference = `pos-${parsed.data.revenue_point_id.slice(0, 8)}-${Date.now()}`
  const callbackUrl = `${appUrl}/api/revenue-points/sales/pay-link/callback?slug=${encodeURIComponent(tenant.slug)}`

  const email = parsed.data.customer_email ?? `pos-${tenant.slug}@pos.local`

  try {
    const result = await initializeTransaction({
      email,
      amountPesewas: parsed.data.total_amount,
      reference,
      callbackUrl,
      channels:      CHANNEL_MAP[parsed.data.payment_method],
      metadata: {
        source:           'pos_sale',
        tenant_id:        tenant.id,
        revenue_point_id: parsed.data.revenue_point_id,
        item_id:          parsed.data.item_id ?? null,
        description:      parsed.data.description,
        quantity:         parsed.data.quantity ?? 1,
        unit_price:       parsed.data.unit_price ?? parsed.data.total_amount,
        total_amount:     parsed.data.total_amount,
        payment_method:   parsed.data.payment_method,
        customer_name:    parsed.data.customer_name ?? null,
        occupant_id:      parsed.data.occupant_id ?? null,
        sold_by:          user.id,
      },
      subaccount: tenant.paystack_subaccount_code,
      bearer:     'subaccount',
    })

    return NextResponse.json({
      authorization_url: result.authorizationUrl,
      reference:         result.reference,
      amount:            parsed.data.total_amount,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Paystack error' }, { status: 502 })
  }
}
