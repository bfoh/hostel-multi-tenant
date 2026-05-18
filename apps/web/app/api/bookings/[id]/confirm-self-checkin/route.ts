import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'

const bodySchema = z.object({
  action: z.enum(['confirm', 'reject']),
  reason: z.string().max(300).optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const admin = createAdminClient()

  const { data: bookingRaw } = await (admin.from('bookings') as any)
    .select('id, status, room_id, occupant_id, self_checkin_submitted_at, self_checkin_confirmed_at, payment_status')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  const booking = bookingRaw as {
    id: string
    status: string
    room_id: string | null
    occupant_id: string
    self_checkin_submitted_at: string | null
    self_checkin_confirmed_at: string | null
    payment_status: string
  } | null

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (!booking.self_checkin_submitted_at) {
    return NextResponse.json({ error: 'Booking is not a self check-in' }, { status: 409 })
  }
  if (booking.self_checkin_confirmed_at) {
    return NextResponse.json({ error: 'Already processed' }, { status: 409 })
  }

  if (parsed.data.action === 'confirm') {
    const newStatus = booking.payment_status === 'paid' ? 'confirmed' : 'pending_payment'

    const { error: updErr } = await admin
      .from('bookings')
      .update({
        status:                   newStatus as 'confirmed',
        self_checkin_confirmed_at: new Date().toISOString(),
        self_checkin_confirmed_by: user.id,
      } as any)
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

    // Activate occupant and mark room occupied
    await admin
      .from('occupants')
      .update({ status: 'active' as const })
      .eq('id', booking.occupant_id)
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')

    if (booking.room_id) {
      await admin.from('rooms').update({ status: 'occupied' }).eq('id', booking.room_id)
    }

    return NextResponse.json({ ok: true, status: newStatus })
  }

  // ── reject ───────────────────────────────────────────────────
  const { error: updErr } = await admin
    .from('bookings')
    .update({
      status:                    'cancelled' as const,
      cancellation_reason:        parsed.data.reason ?? 'Rejected at self check-in confirmation',
      cancelled_at:               new Date().toISOString(),
      self_checkin_confirmed_at:  new Date().toISOString(),
      self_checkin_confirmed_by:  user.id,
    } as any)
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  // Free the room (only if it was reserved/occupied by this booking)
  if (booking.room_id) {
    await admin.from('rooms').update({ status: 'available' }).eq('id', booking.room_id)
  }

  return NextResponse.json({ ok: true, status: 'cancelled' })
}
