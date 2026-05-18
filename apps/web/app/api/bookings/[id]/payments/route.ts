import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { sendPaymentReceipt } from '@/lib/sms'
import { formatGHS } from '@/lib/utils'
import { sendEmail, paymentReceiptHtml } from '@/lib/email'

const schema = z.object({
  amount:    z.number().int().min(1),
  method:    z.enum(['momo_mtn', 'momo_vodafone', 'momo_airteltigo', 'card', 'bank_transfer', 'cash', 'cheque']),
  reference: z.string().max(100).optional().nullable(),
  notes:     z.string().max(300).optional().nullable(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const tenantId = await getServerTenantId()
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 401 })
  }

  // Authenticate caller (RLS-bound client just for auth.getUser)
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Use admin client + explicit tenant scope so RLS can't 404 a valid booking
  // when JWT claims are stale (same pattern as POST /api/occupants).
  const supabase = createAdminClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, occupant_id, final_amount, paid_amount, status')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  if (booking.status === 'cancelled') {
    return NextResponse.json({ error: 'Cannot record payment on a cancelled booking.' }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('booking_payments')
    .insert({
      tenant_id:    tenantId,
      booking_id:   id,
      amount:       parsed.data.amount,
      method:       parsed.data.method,
      reference:    parsed.data.reference ?? null,
      notes:        parsed.data.notes ?? null,
      status:       'success',
      paid_at:      new Date().toISOString(),
      received_by:  user.id,
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Check if fully paid — auto-confirm if was pending_payment
  const newPaidAmount = booking.paid_amount + parsed.data.amount
  if (newPaidAmount >= booking.final_amount && booking.status === 'pending_payment') {
    await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', id)
  }

  // Fire SMS + email receipt — non-blocking
  try {
    const METHOD_LABEL: Record<string, string> = {
      momo_mtn: 'MTN MoMo', momo_vodafone: 'Vodafone Cash',
      momo_airteltigo: 'AirtelTigo Money', cash: 'Cash',
      bank_transfer: 'Bank Transfer', card: 'Card', cheque: 'Cheque',
    }
    const [occupantRes, bookingRes, tenantRes] = await Promise.all([
      supabase.from('occupants').select('first_name, last_name, phone, email').eq('id', booking.occupant_id).single(),
      supabase.from('bookings').select('booking_ref, final_amount, paid_amount').eq('id', id).single(),
      supabase.from('tenants').select('name, primary_color').eq('id', tenantId).single(),
    ])

    const occ       = occupantRes.data
    const bkn       = bookingRes.data
    const ten       = tenantRes.data
    const balance   = Math.max(0, (bkn?.final_amount ?? 0) - ((bkn?.paid_amount ?? 0) + parsed.data.amount))
    const methodLabel = METHOD_LABEL[parsed.data.method] ?? parsed.data.method

    if (occ?.phone) {
      sendPaymentReceipt({
        phone:      occ.phone,
        firstName:  occ.first_name,
        amountGHS:  formatGHS(parsed.data.amount),
        method:     methodLabel,
        bookingRef: bkn?.booking_ref ?? id,
        balance:    formatGHS(balance),
        hostelName: ten?.name ?? 'Your Hostel',
        tenantId,
      }).catch(() => {})
    }

    if (occ?.email && ten) {
      sendEmail({
        to:         occ.email,
        senderName: ten.name,
        subject:    `Payment receipt — ${ten.name}`,
        html:    paymentReceiptHtml({
          hostelName:   ten.name,
          primaryColor: ten.primary_color ?? '#2563EB',
          guestName:    `${occ.first_name} ${occ.last_name}`,
          bookingRef:   bkn?.booking_ref ?? id.slice(0, 8).toUpperCase(),
          amountGHS:    formatGHS(parsed.data.amount),
          method:       methodLabel,
          paidAt:       new Date().toLocaleDateString('en-GH', { dateStyle: 'long' }),
          balance:      formatGHS(balance),
        }),
      }).catch(() => {})
    }
  } catch { /* non-critical */ }

  return NextResponse.json(data, { status: 201 })
}
