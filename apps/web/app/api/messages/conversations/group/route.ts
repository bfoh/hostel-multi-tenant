/**
 * POST /api/messages/conversations/group  { title, member_ids[] }
 * Staff-only — creates a multi-participant group conversation.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createGroup } from '@/lib/messages/server'

const schema = z.object({
  title:      z.string().min(1).max(120),
  member_ids: z.array(z.string().uuid()).min(1).max(200),
})

export async function POST(req: NextRequest) {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const result = await createGroup({
    tenantId,
    createdBy: user.id,
    title:     parsed.data.title,
    memberIds: parsed.data.member_ids,
  })

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 403 })
  }
  return NextResponse.json(result.conversation, { status: 201 })
}
