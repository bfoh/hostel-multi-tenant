import { NextResponse, type NextRequest } from 'next/server'
import { getOccupantSession } from '@/lib/auth/occupant-session'
import { createTenantAdminClient } from '@/lib/supabase/tenant-admin'
import { signedUrlFor } from '@/lib/maintenance/attachments'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ messageId: string; idx: string }> },
) {
  const session = await getOccupantSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messageId, idx } = await params
  const i = Number(idx)
  if (!Number.isFinite(i) || i < 0) return NextResponse.json({ error: 'Bad index' }, { status: 400 })

  const admin = createTenantAdminClient(session.tenantId) as any
  const { data: msg } = await admin
    .from('maintenance_messages')
    .select('attachments, request_id, tenant_id')
    .eq('id', messageId)
    .eq('tenant_id', session.tenantId)
    .maybeSingle()
  if (!msg) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Confirm the request belongs to this occupant
  const { data: parent } = await admin
    .from('maintenance_requests')
    .select('occupant_id')
    .eq('id', msg.request_id)
    .eq('tenant_id', session.tenantId)
    .maybeSingle()
  if (!parent || parent.occupant_id !== session.occupantId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const path = msg.attachments?.[i] as string | undefined
  if (!path) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const url = await signedUrlFor(path)
  if (!url) return NextResponse.json({ error: 'Sign failed' }, { status: 500 })
  return NextResponse.json({ url })
}
