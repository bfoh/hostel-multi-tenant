import { NextResponse, type NextRequest } from 'next/server'
import { getOccupantSession } from '@/lib/auth/occupant-session'
import { createAdminClient } from '@/lib/supabase/admin'
import { getThread } from '@/lib/maintenance/messages'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOccupantSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin  = createAdminClient()

  const { data: req } = await (admin as any)
    .from('maintenance_requests')
    .select('id, tenant_id, occupant_id, status, priority, title, description, created_at, last_message_at, message_count, closed_by_kind, room:rooms(room_number, block)')
    .eq('id', id)
    .eq('tenant_id', session.tenantId)
    .eq('occupant_id', session.occupantId)
    .maybeSingle()

  if (!req) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const thread = await getThread(id, session.tenantId)
  return NextResponse.json({ request: req, thread })
}
