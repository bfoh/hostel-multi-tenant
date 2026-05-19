/**
 * Walk-in payment initiation for a public revenue point flow.
 *
 * Accepts visitor identity + type-specific input (weight, court, duration),
 * recomputes the amount server-side from `revenue_points.public_config`,
 * and initialises a Paystack hosted-page transaction. The sale row is
 * written by the unified Paystack webhook (source='walkin_sale'),
 * which also upserts the visitor row and links it to an existing
 * occupant when the phone matches.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { initializeTransaction } from '@/lib/paystack'
import {
  readPublicConfig,
  priceWalkinSale,
  generateEntryToken,
  type RevenuePointType,
} from '@/lib/walkin-pricing'

const schema = z.object({
  first_name: z.string().min(1).max(80),
  last_name:  z.string().min(1).max(80),
  phone:      z.string().min(9).max(20),
  email:      z.string().email().nullable().optional(),
  input:      z.any().optional(), // type-specific; validated by priceWalkinSale
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; pointId: string }> },
) {
  const { slug, pointId } = await params

  if (!process.env.PAYSTACK_SECRET_KEY) {
    return NextResponse.json({ error: 'Online payment not configured' }, { status: 503 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const supabase = createAdminClient()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, slug, paystack_subaccount_code')
    .eq('slug', slug)
    .single()

  if (!tenant) return NextResponse.json({ error: 'Hostel not found' }, { status: 404 })
  if (!tenant.paystack_subaccount_code) {
    return NextResponse.json({ error: 'Online payment not available here yet.' }, { status: 409 })
  }

  const { data: pointRaw } = await supabase
    .from('revenue_points')
    .select('id, name, type, is_active, public_enabled, public_config')
    .eq('id', pointId)
    .eq('tenant_id', tenant.id)
    .single()
  const point = pointRaw as any

  if (!point || !point.is_active || !point.public_enabled) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 404 })
  }

  const type   = point.type as RevenuePointType
  const config = readPublicConfig(type, point.public_config)
  if (!config) {
    return NextResponse.json({ error: 'Service not configured' }, { status: 409 })
  }

  const priced = priceWalkinSale(config, parsed.data.input)
  if (!priced) {
    return NextResponse.json({ error: 'Invalid request inputs for this service.' }, { status: 422 })
  }

  // Pre-generate the entry token now so we can return it on the receipt
  // page even if the customer disables SMS / closes the tab.
  const entryToken = generateEntryToken()
  const reference  = `wi-${pointId.slice(0, 8)}-${Date.now()}`

  const host  = req.headers.get('host') ?? 'localhost:3000'
  const proto = host.includes('localhost') ? 'http' : 'https'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`
  const callbackUrl = `${appUrl}/visit/${slug}/${pointId}/success?ref=${encodeURIComponent(reference)}&token=${entryToken}`

  const email = parsed.data.email ?? `walkin+${parsed.data.phone.replace(/\D/g, '')}@${slug}.local`

  try {
    const result = await initializeTransaction({
      email,
      amountPesewas: priced.amount,
      reference,
      callbackUrl,
      channels: ['card', 'mobile_money', 'bank', 'bank_transfer'],
      metadata: {
        source:           'walkin_sale',
        tenant_id:        tenant.id,
        revenue_point_id: point.id,
        revenue_point_type: type,
        description:      priced.description,
        amount:           priced.amount,
        first_name:       parsed.data.first_name,
        last_name:        parsed.data.last_name,
        phone:            parsed.data.phone,
        email:            parsed.data.email ?? null,
        duration_minutes: priced.duration_minutes ?? null,
        weight_kg:        priced.weight_kg ?? null,
        court_id:         priced.court_id ?? null,
        court_name:       priced.court_name ?? null,
        entry_token:      entryToken,
      },
      subaccount: tenant.paystack_subaccount_code,
      bearer:     'subaccount',
    })

    return NextResponse.json({
      authorization_url: result.authorizationUrl,
      reference:         result.reference,
      amount:            priced.amount,
      description:       priced.description,
      entry_token:       entryToken,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Paystack error' }, { status: 502 })
  }
}
