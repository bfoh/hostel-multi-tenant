import { NextResponse, type NextRequest } from 'next/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { requireTenantRole } from '@/lib/auth/tenant-role'

/**
 * PATCH /api/bookings/[id]/payments/[paymentId] — reverse a successful
 * payment (e.g. a duplicate manual entry). The database atomically updates
 * the booking subledger and appends a linked reversing journal entry, so the
 * accounting cash/revenue balances cannot retain the reversed receipt.
 */
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  const { id, paymentId } = await params
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const gate = await requireTenantRole(tenantId, ['owner', 'manager'])
  if (gate instanceof NextResponse) return gate

  const supabase = await createTenantAdminClientFromHeaders()

  const { data: payment } = await supabase
    .from('booking_payments')
    .select('id, status')
    .eq('id', paymentId)
    .eq('booking_id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  if (payment.status !== 'success') {
    return NextResponse.json({ error: 'Only a successful payment can be reversed' }, { status: 409 })
  }

  const { error } = await supabase
    .from('booking_payments')
    .update({ status: 'reversed' })
    .eq('id', paymentId)
    .eq('tenant_id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
