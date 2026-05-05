import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { requireTenantRole } from '@/lib/auth/tenant-role'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 400 })

  const ctx = await requireTenantRole(tenantId, ['owner', 'accountant'])
  if (ctx instanceof NextResponse) return ctx

  const { id }   = await params
  const admin    = createAdminClient()
  const cutoffIso = new Date(Date.now() - 5 * 60 * 1000).toISOString()

  // 5-minute server-side window enforcement. Only undo if status is still
  // success AND was approved within the last 5 min.
  const { data: updated, error } = await admin
    .from('booking_payments')
    .update({
      status:      'pending',
      approved_by: null,
      approved_at: null,
      paid_at:     null,
    } as any)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .eq('method', 'bank_draft' as any)
    .eq('status', 'success')
    .gt('approved_at', cutoffIso)
    .select('id')
    .maybeSingle()

  if (error)   return NextResponse.json({ error: error.message }, { status: 500 })
  if (!updated) return NextResponse.json({ error: 'Undo window expired' }, { status: 410 })

  return NextResponse.json({ status: 'pending' })
}
