import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { requireTenantRole } from '@/lib/auth/tenant-role'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ planId: string; installmentId: string }> }
) {
  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const gate = await requireTenantRole(tenantId, ['owner', 'manager', 'receptionist', 'accountant'])
  if (gate instanceof NextResponse) return gate
  const supabase = await createTenantAdminClientFromHeaders()

  const { installmentId } = await params
  const body = await req.json()
  const { status, payment_method, reference, notes } = body

  const VALID_STATUSES = ['pending', 'paid', 'overdue', 'waived']
  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  if (status === 'paid') {
    if (!payment_method) {
      return NextResponse.json({ error: 'Payment method is required' }, { status: 422 })
    }

    const { data, error } = await (supabase as any).rpc('settle_payment_plan_installment', {
      p_tenant_id: tenantId,
      p_installment_id: installmentId,
      p_method: payment_method,
      p_reference: reference ?? null,
      p_actor_id: gate.userId,
      p_paid_at: new Date().toISOString(),
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: ['22003', '23514'].includes(error.code) ? 409 : 500 },
      )
    }
    return NextResponse.json(data)
  }

  const { data: existing } = await (supabase.from('payment_plan_installments') as any)
    .select('status')
    .eq('id', installmentId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (existing?.status === 'paid') {
    return NextResponse.json(
      { error: 'A paid installment cannot be changed; reverse its payment instead.' },
      { status: 409 },
    )
  }

  const { data, error } = await (supabase.from('payment_plan_installments') as any)
    .update({ status, notes })
    .eq('id', installmentId)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
