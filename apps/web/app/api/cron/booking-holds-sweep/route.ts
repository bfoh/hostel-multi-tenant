import { NextResponse, type NextRequest } from 'next/server'

import { cancelBooking } from '@/lib/bookings/cancel-booking'
import { createAdminClient } from '@/lib/supabase/admin'

type ExpiredHold = {
  id: string
  tenant_id: string
  status: string
  source: string
}

export async function POST(req: NextRequest) {
  return handle(req)
}
export async function GET(req: NextRequest) {
  return handle(req)
}

/**
 * Cancels expired, unpaid booking holds. The cancellation service provides
 * the same timestamps, audit data, bank-draft handling and notifications as a
 * staff cancellation. Re-running the sweep is safe because the RPC is
 * idempotent and every query only selects active hold statuses.
 */
async function handle(req: NextRequest) {
  const secret =
    req.headers.get('x-cron-secret') ??
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    req.nextUrl.searchParams.get('secret')

  // This endpoint can cancel bookings, so it must fail closed when the
  // deployment has not been configured with a scheduler secret.
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient() as any
  const now = new Date().toISOString()
  const legacyCutoff = new Date(Date.now() - 30 * 60_000).toISOString()

  const [explicitHolds, legacyHolds, selfCheckins] = await Promise.all([
    admin
      .from('bookings')
      .select('id, tenant_id, status, source')
      .eq('status', 'pending_payment')
      .eq('payment_status', 'unpaid')
      .in('source', ['website', 'widget', 'voice_ai'])
      .not('hold_expires_at', 'is', null)
      .lt('hold_expires_at', now)
      .limit(100),
    admin
      .from('bookings')
      .select('id, tenant_id, status, source')
      .eq('status', 'pending_payment')
      .eq('payment_status', 'unpaid')
      .in('source', ['website', 'widget', 'voice_ai'])
      .is('hold_expires_at', null)
      .lt('created_at', legacyCutoff)
      .limit(100),
    admin
      .from('bookings')
      .select('id, tenant_id, status, source')
      .eq('status', 'pending_confirmation')
      .eq('payment_status', 'unpaid')
      .not('self_checkin_submitted_at', 'is', null)
      .lt('self_checkin_submitted_at', legacyCutoff)
      .limit(100),
  ])

  const queryError = explicitHolds.error ?? legacyHolds.error ?? selfCheckins.error
  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 })

  const unique = new Map<string, ExpiredHold>()
  for (const row of [
    ...(explicitHolds.data ?? []),
    ...(legacyHolds.data ?? []),
    ...(selfCheckins.data ?? []),
  ] as ExpiredHold[]) {
    unique.set(row.id, row)
  }

  const failures: { id: string; error: string }[] = []
  let cancelled = 0

  const bookings = Array.from(unique.values())
  for (let offset = 0; offset < bookings.length; offset += 10) {
    const batch = bookings.slice(offset, offset + 10)
    await Promise.all(
      batch.map(async (booking) => {
        const selfCheckin = booking.status === 'pending_confirmation'
        try {
          const result = await cancelBooking(admin, {
            tenantId: booking.tenant_id,
            bookingId: booking.id,
            reason: selfCheckin
              ? 'Self check-in was not completed before the hold expired'
              : 'Online payment was not completed before the hold expired',
            source: selfCheckin ? 'self_checkin_expired' : 'payment_expired',
            expectedStatus: booking.status,
          })
          if (result.changed) cancelled++
        } catch (error) {
          failures.push({
            id: booking.id,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      })
    )
  }

  return NextResponse.json(
    {
      examined: unique.size,
      cancelled,
      failed: failures.length,
      failures,
    },
    { status: failures.length > 0 ? 207 : 200 }
  )
}
