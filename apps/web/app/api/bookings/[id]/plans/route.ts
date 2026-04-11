import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { id: bookingId } = await params

  const { data, error } = await supabase
    .from('payment_plans')
    .select('*, payment_plan_installments(*)')
    .eq('booking_id', bookingId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const { id: bookingId } = await params
  const body = await req.json()
  const { name, installments_count, start_date, interval_days } = body

  if (!installments_count || installments_count < 2 || installments_count > 12) {
    return NextResponse.json({ error: 'installments_count must be 2–12' }, { status: 400 })
  }

  // Fetch booking to get final_amount and verify tenant
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, final_amount, paid_amount')
    .eq('id', bookingId)
    .eq('tenant_id', tenantId)
    .single()

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  const balance = booking.final_amount - booking.paid_amount
  if (balance <= 0) return NextResponse.json({ error: 'No outstanding balance' }, { status: 400 })

  // Create the plan
  const { data: plan, error: planErr } = await supabase
    .from('payment_plans')
    .insert({
      tenant_id:          tenantId,
      booking_id:         bookingId,
      name:               name || `${installments_count}-installment plan`,
      total_amount:       balance,
      installments_count: installments_count,
      created_by:         user.id,
    })
    .select()
    .single()

  if (planErr) return NextResponse.json({ error: planErr.message }, { status: 500 })

  // Auto-generate installments: equal splits, spaced by interval_days (default 30)
  const dayGap = Math.max(1, interval_days ?? 30)
  const baseAmount = Math.floor((balance / installments_count) * 100) / 100
  const remainder  = Math.round((balance - baseAmount * installments_count) * 100) / 100
  const firstDate  = start_date ? new Date(start_date) : new Date()

  const installments = Array.from({ length: installments_count }, (_, i) => {
    const dueDate = new Date(firstDate)
    dueDate.setDate(dueDate.getDate() + i * dayGap)
    return {
      plan_id:            plan.id,
      tenant_id:          tenantId,
      installment_number: i + 1,
      amount:             i === 0 ? baseAmount + remainder : baseAmount,
      due_date:           dueDate.toISOString().slice(0, 10),
    }
  })

  const { error: insErr } = await supabase
    .from('payment_plan_installments')
    .insert(installments)

  if (insErr) {
    await supabase.from('payment_plans').delete().eq('id', plan.id)
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  return NextResponse.json(plan, { status: 201 })
}
