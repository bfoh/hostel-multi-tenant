/**
 * PATCH  /api/messages/messages/[id]   { body }   — edit own message
 * DELETE /api/messages/messages/[id]              — soft-delete own message
 */
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'

const patchSchema = z.object({ body: z.string().min(1).max(4000) })

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 422 })

  const admin = await createTenantAdminClientFromHeaders() as any
  const { data, error } = await admin
    .from('messages')
    .update({ body: parsed.data.body.trim(), edited_at: new Date().toISOString() })
    .eq('id', id)
    .eq('sender_id', user.id)
    .is('deleted_at', null)
    .select('id, body, edited_at')
    .single()

  if (error || !data) return NextResponse.json({ error: 'not found or not yours' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await createTenantAdminClientFromHeaders() as any
  const { error } = await admin
    .from('messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('sender_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
