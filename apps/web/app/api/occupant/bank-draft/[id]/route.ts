import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOccupantSession } from '@/lib/auth/occupant-session'
import { BANK_DRAFTS_BUCKET } from '@/lib/bank-draft'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOccupantSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  // Verify the row belongs to this occupant + tenant AND is pending.
  const { data: rowRaw } = await admin
    .from('booking_payments')
    .select('id, status, method, draft_file_path, booking:bookings!inner(occupant_id, tenant_id)')
    .eq('id', id)
    .single()
  const row = rowRaw as any

  const booking = Array.isArray(row?.booking) ? row?.booking[0] : (row?.booking as any)
  const owns = !!row && booking?.occupant_id === session.occupantId && booking?.tenant_id === session.tenantId

  if (!row || !owns)                      return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (row.method !== 'bank_draft')        return NextResponse.json({ error: 'Not a bank draft' }, { status: 400 })
  if (row.status !== 'pending')           return NextResponse.json({ error: 'Only pending drafts can be cancelled' }, { status: 400 })

  // 1. Delete the file first. If this fails, keep the row (retryable).
  if ((row as any).draft_file_path) {
    const { error: storageErr } = await admin.storage
      .from(BANK_DRAFTS_BUCKET)
      .remove([(row as any).draft_file_path])
    if (storageErr) {
      return NextResponse.json({ error: 'Could not delete file. Try again.' }, { status: 503 })
    }
  }

  // 2. Then delete the row (optimistic lock — only if still pending).
  const { error: deleteErr } = await admin
    .from('booking_payments')
    .delete()
    .eq('id', id)
    .eq('status', 'pending')

  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
