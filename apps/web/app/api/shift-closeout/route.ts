import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { getServerTenantId } from '@/lib/auth/tenant'

/**
 * POST /api/shift-closeout
 * Staff submits their cash declaration. System computes the actual cash/digital
 * totals from booking_payments for the day and records the discrepancy.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body.declared_cash !== 'number') {
    return NextResponse.json({ error: 'declared_cash is required (pesewas)' }, { status: 422 })
  }

  const shiftDate = body.shift_date ?? new Date().toISOString().slice(0, 10)
  const admin = await createTenantAdminClientFromHeaders()

  // Calculate system totals for this staff member today
  const { data: payments } = await admin
    .from('booking_payments')
    .select('amount, method')
    .eq('tenant_id', tenantId)
    .eq('status', 'success')
    .eq('received_by', user.id)
    .gte('paid_at', `${shiftDate}T00:00:00`)
    .lte('paid_at', `${shiftDate}T23:59:59`)

  const rows = payments ?? []
  const systemCash    = rows.filter(p => p.method === 'cash').reduce((s, p) => s + p.amount, 0)
  const systemDigital = rows.filter(p => p.method !== 'cash').reduce((s, p) => s + p.amount, 0)
  const paymentCount  = rows.filter(p => p.method === 'cash').length

  const declaredCash = body.declared_cash as number
  const discrepancy  = declaredCash - systemCash

  // Auto-flag if discrepancy > 5% of system total or > GHS 50
  const autoFlag = systemCash > 0 && (
    Math.abs(discrepancy) > systemCash * 0.05 ||
    Math.abs(discrepancy) > 5000 // 50 GHS in pesewas
  )

  const { data: closeout, error } = await (admin as any)
    .from('shift_closeouts')
    .insert({
      tenant_id:      tenantId,
      staff_id:       user.id,
      shift_date:     shiftDate,
      system_cash:    systemCash,
      declared_cash:  declaredCash,
      system_digital: systemDigital,
      payment_count:  paymentCount,
      notes:          body.notes ?? null,
      status:         autoFlag ? 'flagged' : 'pending',
    })
    .select('id, system_cash, declared_cash, discrepancy, system_digital, payment_count, status')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(closeout)
}
