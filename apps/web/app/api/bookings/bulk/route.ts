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

    const { error } = await supabase
      .from('bookings')
      .update({ status: value as any })
      .in('id', ids)
      .eq('tenant_id', tenantId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, affected: ids.length })
  }

  if (action === 'mark_paid') {
    const { error } = await supabase
      .from('bookings')
      .update({ payment_status: 'paid' })
      .in('id', ids)
      .eq('tenant_id', tenantId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, affected: ids.length })
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
