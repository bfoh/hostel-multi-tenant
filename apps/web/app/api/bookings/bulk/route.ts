import { NextResponse, type NextRequest } from 'next/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { getServerTenantId } from '@/lib/auth/tenant'

const ALLOWED_STATUSES = ['pending_payment', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show']

/**
 * POST /api/bookings/bulk
 * Body: { ids: string[], action: 'set_status' | 'mark_paid', value?: string }
 */
export async function POST(req: NextRequest) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const supabase = await createTenantAdminClientFromHeaders()

  const body = await req.json()
  const { ids, action, value } = body as { ids: string[]; action: string; value?: string }

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 })
  }
  if (ids.length > 100) {
    return NextResponse.json({ error: 'Maximum 100 bookings per bulk operation' }, { status: 400 })
  }

  if (action === 'set_status') {
    if (!value || !ALLOWED_STATUSES.includes(value)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const { data: rows, error: fetchErr } = await supabase
      .from('bookings')
      .select('id, occupant_id')
      .in('id', ids)
      .eq('tenant_id', tenantId)

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

    const { error } = await supabase
      .from('bookings')
      .update({ status: value as any })
      .in('id', ids)
      .eq('tenant_id', tenantId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Sync occupant lifecycle to mirror the booking transition.
    const occupantIds = Array.from(
      new Set((rows ?? []).map((r) => r.occupant_id).filter(Boolean) as string[]),
    )

    if (occupantIds.length > 0) {
      if (value === 'checked_in') {
        await (supabase.from('occupants') as any)
          .update({ status: 'active' })
          .in('id', occupantIds)
          .neq('status', 'active')
      } else if (value === 'checked_out') {
        // Only mark occupants checked_out if they have no other active stay.
        for (const occupantId of occupantIds) {
          const { count: stillActive } = await supabase
            .from('bookings')
            .select('id', { count: 'exact', head: true })
            .eq('occupant_id', occupantId)
            .not('id', 'in', `(${ids.join(',')})`)
            .in('status', ['confirmed', 'checked_in', 'pending_payment'])

          if (!stillActive) {
            await (supabase.from('occupants') as any)
              .update({ status: 'checked_out' })
              .eq('id', occupantId)
          }
        }
      }
    }

    return NextResponse.json({ ok: true, affected: ids.length })
  }

  if (action === 'mark_paid') {
    // Fetch each booking so we can sync paid_amount = final_amount and
    // promote pending_payment → confirmed atomically per row.
    const { data: rows, error: fetchErr } = await supabase
      .from('bookings')
      .select('id, final_amount, status')
      .in('id', ids)
      .eq('tenant_id', tenantId)

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

    const updates = (rows ?? []).map((b) => {
      const patch: Record<string, unknown> = {
        payment_status: 'paid',
        paid_amount:    b.final_amount,
      }
      if (b.status === 'pending_payment') patch.status = 'confirmed'

      return supabase
        .from('bookings')
        .update(patch as any)
        .eq('id', b.id)
        .eq('tenant_id', tenantId)
    })

    const results = await Promise.all(updates)
    const failed  = results.find((r) => r.error)
    if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 })

    return NextResponse.json({ ok: true, affected: rows?.length ?? 0 })
  }

  if (action === 'delete') {
    const { error } = await supabase
      .from('bookings')
      .delete()
      .in('id', ids)
      .eq('tenant_id', tenantId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, affected: ids.length })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
