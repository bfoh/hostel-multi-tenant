/**
 * POST /api/messages/conversations/[id]/read
 *
 * Bumps the caller's `last_read_at` for this conversation. Idempotent.
 */
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { markRead } from '@/lib/messages/server'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await markRead({ tenantId, conversationId: id, userId: user.id })
  return NextResponse.json({ ok: true })
}
