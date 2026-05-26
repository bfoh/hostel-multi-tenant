import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createTenantAdminClient } from '@/lib/supabase/tenant-admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { initializeTransaction } from '@/lib/paystack'

const schema = z.object({
  booking_id: z.string().uuid(),
  amount:     z.number().int().positive(),   // pesewas
})

// POST /api/occupant/pay — initiate Paystack payment for an authenticated occupant
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 400 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 422 })

  const admin = createTenantAdminClient(tenantId)

  // Verify the booking belongs to this occupant + tenant
  const { data: occupant } = await admin
    .from('occupants')
    .select('id, email, first_name, last_name')
    .eq('user_id', user.id as any)
    .eq('tenant_id', tenantId)
    .single()

  if (!occupant) return NextResponse.json({ error: 'Occupant not found' }, { status: 404 })

  const { data: booking } = await admin
    .from('bookings')
    .select('id, booking_ref, final_amount, paid_amount, status')
    .eq('id', parsed.data.booking_id)
    .eq('tenant_id', tenantId)
    .eq('occupant_id', occupant.id)
    .single()

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (booking.status === 'cancelled') return NextResponse.json({ error: 'Booking is cancelled' }, { status: 400 })

  const balance = booking.final_amount - booking.paid_amount
  if (balance <= 0) return NextResponse.json({ error: 'Already fully paid' }, { status: 400 })

  const amount = Math.min(parsed.data.amount, balance)

  if (!process.env.PAYSTACK_SECRET_KEY) {
    return NextResponse.json({ error: 'Online payment not configured' }, { status: 503 })
  }

  // Load tenant subaccount so funds settle to the hostel's bank
  const { data: tenantRow } = await admin
    .from('tenants')
    .select('paystack_subaccount_code')
    .eq('id', tenantId)
    .single()

  const subaccount = tenantRow?.paystack_subaccount_code ?? null
  if (!subaccount) {
    return NextResponse.json(
      { error: 'Online payments are not set up for this hostel yet.' },
      { status: 409 },
    )
  }

  const host    = req.headers.get('host') ?? 'localhost:3000'
  const proto   = host.includes('localhost') ? 'http' : 'https'
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`
  const callbackUrl = `${appUrl}/api/occupant/pay/callback?booking_id=${booking.id}&amount=${amount}`

  try {
    const result = await initializeTransaction({
      email:       occupant.email ?? `${booking.booking_ref.toLowerCase()}@portal.local`,
      amountPesewas: amount,
      reference:   `${booking.booking_ref}-${Date.now()}`,
      callbackUrl,
      channels:    ['card', 'mobile_money', 'bank', 'bank_transfer'],
      metadata: {
        booking_id:  booking.id,
        booking_ref: booking.booking_ref,
        tenant_id:   tenantId,
        source:      'occupant_portal',
      },
      subaccount,
      bearer: 'subaccount',
    })

    return NextResponse.json({
      authorization_url: result.authorizationUrl,
      reference:         result.reference,
      amount,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Paystack error' }, { status: 502 })
  }
}
