/**
 * POST   /api/messages/messages/[id]/react   { emoji }   — add reaction
 * DELETE /api/messages/messages/[id]/react?emoji=X       — remove reaction
 */
import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const schema = z.object({ emoji: z.string().min(1).max(16) })

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: messageId } = await params

  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 422 })

  const admin = createAdminClient() as any
  const { error } = await admin
    .from('message_reactions')
    .upsert(
      { message_id: messageId, user_id: user.id, emoji: parsed.data.emoji },
      { onConflict: 'message_id,user_id,emoji', ignoreDuplicates: true },
    )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: messageId } = await params
  const emoji = req.nextUrl.searchParams.get('emoji')
  if (!emoji) return NextResponse.json({ error: 'emoji query required' }, { status: 422 })

  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient() as any
  await admin
    .from('message_reactions')
    .delete()
    .eq('message_id', messageId)
    .eq('user_id', user.id)
    .eq('emoji', emoji)
  return NextResponse.json({ ok: true })
}
