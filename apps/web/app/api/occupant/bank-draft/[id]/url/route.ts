import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOccupantSession } from '@/lib/auth/occupant-session'
import { getSignedDraftUrl } from '@/lib/bank-draft'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOccupantSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin  = createAdminClient()

  const { data: rowRaw } = await admin
    .from('booking_payments')
    .select('id, draft_file_path, booking:bookings!inner(occupant_id)')
    .eq('id', id)
    .eq('tenant_id', session.tenantId)
    .single()
  const row = rowRaw as any

  const booking = Array.isArray(row?.booking) ? row?.booking[0] : (row?.booking as any)
  if (!row || booking?.occupant_id !== session.occupantId || !row.draft_file_path) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const url = await getSignedDraftUrl(row.draft_file_path, 600)
  if (!url) return NextResponse.json({ error: 'Could not sign URL' }, { status: 500 })
  return NextResponse.json({ url })
}
