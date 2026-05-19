/**
 * PATCH /api/messages/conversations/[id]/actions
 *
 * Per-user conversation controls. Body is one of:
 *   { mute_days: number }     // null/0 = unmute
 *   { archive: boolean }
 *   { pin: boolean }
 *   { rename: string }        // group + broadcast only; sets conversations.title
 *
 * Writes to conversation_participants for the caller; group rename also
 * updates the parent conversations row when the caller has owner/admin role.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const schema = z.object({
  mute_days: z.number().int().min(0).max(365).optional(),
  archive:   z.boolean().optional(),
  pin:       z.boolean().optional(),
  rename:    z.string().min(1).max(120).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

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

  const admin = createAdminClient() as any

  const partUpdate: Record<string, unknown> = {}
  if (parsed.data.mute_days !== undefined) {
    partUpdate.muted_until = parsed.data.mute_days > 0
      ? new Date(Date.now() + parsed.data.mute_days * 24 * 3600 * 1000).toISOString()
      : null
  }
  if (parsed.data.archive !== undefined) {
    partUpdate.archived_at = parsed.data.archive ? new Date().toISOString() : null
  }
  if (parsed.data.pin !== undefined) {
    partUpdate.pinned_at = parsed.data.pin ? new Date().toISOString() : null
  }

  if (Object.keys(partUpdate).length > 0) {
    const { error } = await admin
      .from('conversation_participants')
      .update(partUpdate)
      .eq('conversation_id', id)
      .eq('user_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (parsed.data.rename) {
    const { data: me } = await admin
      .from('conversation_participants')
      .select('role')
      .eq('conversation_id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!me || !['owner', 'admin'].includes(me.role)) {
      return NextResponse.json({ error: 'Only group owners/admins can rename' }, { status: 403 })
    }
    const { error: titleErr } = await admin
      .from('conversations')
      .update({ title: parsed.data.rename.trim() })
      .eq('id', id)
      .eq('tenant_id', tenantId)
    if (titleErr) return NextResponse.json({ error: titleErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
