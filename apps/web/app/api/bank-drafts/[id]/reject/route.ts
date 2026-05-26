import { NextResponse, type NextRequest, after } from 'next/server'
import { z } from 'zod'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { requireTenantRole } from '@/lib/auth/tenant-role'
import { dispatchDraftRejected } from '@/lib/bank-draft'

const schema = z.object({ reason: z.string().min(3).max(500) })

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 400 })

  const ctx = await requireTenantRole(tenantId, ['owner', 'accountant'])
  if (ctx instanceof NextResponse) return ctx

  const body   = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Reason is required (3-500 chars)' }, { status: 422 })

  const { id } = await params
  const admin  = await createTenantAdminClientFromHeaders()

  const { data: updated, error } = await admin
    .from('booking_payments')
    .update({
      status:          'failed',
      rejected_reason: parsed.data.reason,
      rejected_by:     ctx.userId,
      rejected_at:     new Date().toISOString(),
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
      await dispatchDraftRejected({
        tenantId,
        occupantId: booking.occupant_id,
        amount:     row.amount,
        bookingId:  row.booking_id,
        bookingRef: booking.booking_ref,
        reason:     parsed.data.reason,
      })
    } catch (e) {
      console.error('[bank-draft] reject dispatch failed', e)
    }
  })

  return NextResponse.json({ status: 'failed' })
}
