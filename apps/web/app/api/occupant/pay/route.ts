import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'

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

  const admin = createAdminClient()

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

  const paystackKey = process.env.PAYSTACK_SECRET_KEY
  if (!paystackKey) return NextResponse.json({ error: 'Online payment not configured' }, { status: 503 })

  const host    = req.headers.get('host') ?? 'localhost:3000'
  const proto   = host.includes('localhost') ? 'http' : 'https'
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`
  const callbackUrl = `${appUrl}/api/occupant/pay/callback?booking_id=${booking.id}&amount=${amount}`

  const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${paystackKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email:        occupant.email ?? `${booking.booking_ref.toLowerCase()}@portal.local`,
      amount,
      currency:     'GHS',
      reference:    `${booking.booking_ref}-${Date.now()}`,
      callback_url: callbackUrl,
      metadata: {
        booking_id:  booking.id,
        booking_ref: booking.booking_ref,
        tenant_id:   tenantId,
        source:      'occupant_portal',
      },
    }),
  })

  const psData = await paystackRes.json()
  if (!psData.status) return NextResponse.json({ error: psData.message ?? 'Paystack error' }, { status: 502 })

  return NextResponse.json({ authorization_url: psData.data.authorization_url, reference: psData.data.reference, amount })
}
