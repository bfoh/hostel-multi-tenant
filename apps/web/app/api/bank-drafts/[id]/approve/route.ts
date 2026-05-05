import { NextResponse, type NextRequest, after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { requireTenantRole } from '@/lib/auth/tenant-role'
import { dispatchDraftApproved } from '@/lib/bank-draft'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 400 })

  const ctx = await requireTenantRole(tenantId, ['owner', 'accountant'])
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  const admin  = createAdminClient()
  const now    = new Date().toISOString()

  // Optimistic-lock UPDATE: only flip if still pending. .select() is
  // required so we can detect 0-row updates (someone else already
  // processed this draft).
  const { data: updated, error } = await admin
    .from('booking_payments')
    .update({
      status:      'success',
      paid_at:     now,
      approved_by: ctx.userId,
      approved_at: now,
    } as any)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .eq('method', 'bank_draft' as any)
    .eq('status', 'pending')
    .select('id, amount, booking_id, booking:bookings!inner(occupant_id, booking_ref)')
    .maybeSingle()

  if (error)   return NextResponse.json({ error: error.message }, { status: 500 })
  if (!updated) return NextResponse.json({ error: 'Already processed' }, { status: 409 })

  const row     = updated as any
  const booking = Array.isArray(row.booking) ? row.booking[0] : row.booking

  after(async () => {
    try {
      await dispatchDraftApproved({
        tenantId,
        occupantId: booking.occupant_id,
        amount:     row.amount,
        bookingId:  row.booking_id,
        bookingRef: booking.booking_ref,
      })
    } catch (e) {
      console.error('[bank-draft] approve dispatch failed', e)
    }
  })

  return NextResponse.json({ status: 'success' })
}
