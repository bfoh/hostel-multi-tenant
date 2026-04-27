import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyCharge } from '@/lib/paystack'

const schema = z.object({ payment_id: z.string().uuid() })

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 422 })

  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const supabase = createAdminClient()

  const { data: payment } = await supabase
    .from('booking_payments')
    .select('id, reference, status, booking_id')
    .eq('id', parsed.data.payment_id)
    .single()

  if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  if (payment.status === 'success') return NextResponse.json({ status: 'success' })
  if (!payment.reference) return NextResponse.json({ status: payment.status })

  try {
    const charge = await verifyCharge(payment.reference)

    if (charge.status === 'success') {
      await supabase
        .from('booking_payments')
        .update({ status: 'success', paid_at: new Date().toISOString() })
        .eq('id', payment.id)
    }

    return NextResponse.json({ status: charge.status })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 502 })
  }
}
