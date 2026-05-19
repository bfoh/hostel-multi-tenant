/**
 * GET  /api/messages/conversations          → inbox list
 * POST /api/messages/conversations          → create-or-find direct conversation
 *                                              body: { peer_user_id }
 *                                              (group + broadcast handled by dedicated routes in Phase 4)
 */
import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createOrFindDirect, listInbox } from '@/lib/messages/server'

const createSchema = z.object({
  peer_user_id: z.string().uuid(),
})

export async function GET() {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const items = await listInbox({ tenantId, userId: user.id })
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const result = await createOrFindDirect({
    tenantId,
    initiatorId: user.id,
    peerId:      parsed.data.peer_user_id,
  })
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 409 })

  return NextResponse.json(result.conversation, { status: 201 })
}
