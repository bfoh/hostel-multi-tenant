import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { sendBookingConfirmation } from '@/lib/sms'
import { formatDate } from '@/lib/utils'
import { createBooking } from '@/lib/bookings/create-booking'

const schema = z.object({
  occupant_id:     z.string().uuid(),
  room_id:         z.string().uuid(),
  check_in_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source:          z.enum(['walk_in', 'phone', 'website', 'widget', 'voice_ai', 'referral']),
  semester:        z.string().optional().nullable(),
  academic_year:   z.string().optional().nullable(),
  discount_amount: z.number().int().min(0).default(0),
  discount_reason: z.string().max(200).optional().nullable(),
  notes:           z.string().max(500).optional().nullable(),
})

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const tenantId = await getServerTenantId()
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 401 })
  }

  const supabase = await createTenantAdminClientFromHeaders()
  const d = parsed.data

  const result = await createBooking(supabase, tenantId, d)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  // Fire SMS confirmation — non-blocking
  try {
    const [occupantRes, tenantRes] = await Promise.all([
      supabase.from('occupants').select('first_name, phone').eq('id', d.occupant_id).single(),
      supabase.from('tenants').select('name').eq('id', tenantId).single(),
    ])
    if (occupantRes.data?.phone) {
      sendBookingConfirmation({
        phone:       occupantRes.data.phone,
        firstName:   occupantRes.data.first_name,
        bookingRef:  result.bookingRef,
        roomNumber:  result.roomNumber ?? '—',
        checkInDate: formatDate(d.check_in_date),
        hostelName:  tenantRes.data?.name ?? 'Your Property',
        tenantId,
      }).catch(() => {}) // swallow errors — SMS must never break booking creation
    }
  } catch { /* non-critical */ }

  return NextResponse.json({ id: result.bookingId, booking_ref: result.bookingRef }, { status: 201 })
}
