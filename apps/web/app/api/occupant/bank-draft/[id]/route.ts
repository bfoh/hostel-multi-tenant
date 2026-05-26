import { NextResponse, type NextRequest } from 'next/server'
import { createTenantAdminClient } from '@/lib/supabase/tenant-admin'
import { getOccupantSession } from '@/lib/auth/occupant-session'
import { BANK_DRAFTS_BUCKET } from '@/lib/bank-draft'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOccupantSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createTenantAdminClient(session.tenantId)

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

  // 1. Delete the row FIRST with an optimistic lock that returns the
  //    affected row(s). If admin approved between our status check above
  //    and now, the .eq('status','pending') filter matches zero rows and
  //    we 409 — without touching the storage object that's now evidence
  //    for an approved payment.
  //
  //    (Doing the file delete first, as an earlier draft of this route did,
  //    introduces a race where a successful approval ends up with a payment
  //    row whose draft_file_path points to a file we already removed.)
  const { data: deleted, error: deleteErr } = await admin
    .from('booking_payments')
    .delete()
    .eq('id', id)
    .eq('status', 'pending')
    .select('id')

  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 })
  if (!deleted || deleted.length === 0) {
    return NextResponse.json(
      { error: 'Draft was just processed by reception. Refresh to see the latest status.' },
      { status: 409 },
    )
  }

  // 2. Best-effort file delete. Failure here only leaves an orphaned blob
  //    (no DB row references it), which is safe and cleanable later. We
  //    still log so cleanup can be verified.
  if (row.draft_file_path) {
    const { error: storageErr } = await admin.storage
      .from(BANK_DRAFTS_BUCKET)
      .remove([row.draft_file_path])
    if (storageErr) {
      console.error('[bank-draft] orphan file after cancel:', row.draft_file_path, storageErr.message)
    }
  }

  return NextResponse.json({ ok: true })
}
