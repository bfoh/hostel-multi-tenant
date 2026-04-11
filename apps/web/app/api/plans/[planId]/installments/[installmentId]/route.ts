import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ planId: string; installmentId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const { installmentId } = await params
  const body = await req.json()
  const { status, payment_method, reference, notes } = body

  const VALID_STATUSES = ['pending', 'paid', 'overdue', 'waived']
  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const update: Record<string, unknown> = { status, notes }
  if (status === 'paid') {
    update.paid_at = new Date().toISOString()
    update.payment_method = payment_method ?? null
    update.reference = reference ?? null
  }

  const { data, error } = await (supabase.from('payment_plan_installments') as any)
    .update(update)
    .eq('id', installmentId)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If paid, update booking's paid_amount
  if (status === 'paid' && data) {
    const { data: plan } = await supabase
      .from('payment_plans')
      .select('booking_id')
      .eq('id', data.plan_id)
      .single()

    if (plan) {
      const { data: booking } = await supabase
        .from('bookings')
        .select('paid_amount, final_amount')
        .eq('id', plan.booking_id)
        .single()

      if (booking) {
        const newPaid = booking.paid_amount + data.amount
        const newPaymentStatus = newPaid >= booking.final_amount ? 'paid'
          : newPaid > 0 ? 'partial' : 'unpaid'
        await supabase
          .from('bookings')
          .update({ paid_amount: newPaid, payment_status: newPaymentStatus })
          .eq('id', plan.booking_id)
      }
    }
  }

  return NextResponse.json(data)
}
