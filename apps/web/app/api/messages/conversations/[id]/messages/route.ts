/**
 * GET  /api/messages/conversations/[id]/messages?cursor=&limit=
 *      → page of messages (descending by created_at; cursor is the oldest seen id)
 *
 * POST /api/messages/conversations/[id]/messages
 *      body: { body?, kind?, reply_to_id?, attachments? }
 */
import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { postMessage } from '@/lib/messages/server'

const postSchema = z.object({
  body:         z.string().max(4000).nullable().optional(),
  kind:         z.enum(['text','image','file','audio','system']).optional(),
  reply_to_id:  z.string().uuid().nullable().optional(),
  attachments:  z.array(z.unknown()).max(10).optional(),
})

const PAGE_SIZE = 50

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: conversationId } = await params

  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient() as any

  // Participation check (also implicit via RLS but explicit here for 403)
  const { data: part } = await admin
    .from('conversation_participants')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!part) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const cursor = req.nextUrl.searchParams.get('cursor')
  const limit  = Math.min(PAGE_SIZE, parseInt(req.nextUrl.searchParams.get('limit') ?? String(PAGE_SIZE), 10))

  let q = admin
    .from('messages')
    .select(`
      id, conversation_id, sender_id, kind, body, reply_to_id, attachments, metadata,
      edited_at, deleted_at, created_at,
      reactions:message_reactions(id, emoji, user_id)
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit + 1)

  if (cursor) q = q.lt('created_at', cursor)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []) as any[]
  const hasMore = rows.length > limit
  const trimmed = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? trimmed[trimmed.length - 1].created_at : null

  return NextResponse.json({
    messages: trimmed.reverse(),     // ascending for thread render
    next_cursor: nextCursor,
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: conversationId } = await params

  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const result = await postMessage({
    tenantId,
    conversationId,
    senderId:    user.id,
    body:        parsed.data.body ?? null,
    kind:        parsed.data.kind,
    replyToId:   parsed.data.reply_to_id ?? null,
    attachments: parsed.data.attachments ?? [],
  })

  if ('error' in result) {
    const isForbidden = /broadcast/i.test(result.error)
    return NextResponse.json({ error: result.error }, { status: isForbidden ? 403 : 400 })
  }

  return NextResponse.json(result.message, { status: 201 })
}
