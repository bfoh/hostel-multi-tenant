/**
 * POST /api/messages/attachments/sign  { conversation_id, filename, mime, size }
 *
 * Returns a signed upload URL + the storage path the client should target.
 * Path convention: conversations/<conv_id>/<sender_id>/<uuid>.<ext>
 *
 * Server-side validation:
 *   - caller is participant of conversation
 *   - mime is in our allow-list (image, pdf, audio/webm)
 *   - size <= 10 MB (8 MB for images, 2 MB for audio)
 */
import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'

const MB = 1024 * 1024
const LIMITS: { test: (m: string) => boolean; max: number }[] = [
  { test: m => m.startsWith('image/'), max: 8 * MB },
  { test: m => m === 'application/pdf', max: 10 * MB },
  { test: m => m.startsWith('audio/'), max: 2 * MB },
  { test: m => m.startsWith('video/'), max: 15 * MB },
]

const schema = z.object({
  conversation_id: z.string().uuid(),
  filename:        z.string().min(1).max(200),
  mime:            z.string().min(1).max(120),
  size:            z.number().int().min(1).max(15 * MB),
})

function extFromName(name: string, mime: string): string {
  const m = name.match(/\.([a-zA-Z0-9]{1,10})$/)
  if (m) return m[1].toLowerCase()
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/png')  return 'png'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'application/pdf') return 'pdf'
  if (mime === 'audio/webm') return 'webm'
  if (mime === 'audio/mp4')  return 'm4a'
  return 'bin'
}

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

  const limit = LIMITS.find(l => l.test(parsed.data.mime))
  if (!limit) return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 })
  if (parsed.data.size > limit.max) {
    return NextResponse.json({ error: `Too big (max ${Math.round(limit.max / MB)} MB)` }, { status: 413 })
  }

  const admin = await createTenantAdminClientFromHeaders() as any

  // Participation check
  const { data: part } = await admin
    .from('conversation_participants')
    .select('id')
    .eq('conversation_id', parsed.data.conversation_id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!part) return NextResponse.json({ error: 'Not a participant' }, { status: 403 })

  const ext = extFromName(parsed.data.filename, parsed.data.mime)
  const id  = crypto.randomUUID()
  const path = `conversations/${parsed.data.conversation_id}/${user.id}/${id}.${ext}`

  const { data, error } = await admin.storage.from('messages').createSignedUploadUrl(path)
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'sign failed' }, { status: 500 })

  return NextResponse.json({
    upload_url: data.signedUrl,
    token:      data.token,
    path,
    mime:       parsed.data.mime,
    size:       parsed.data.size,
    filename:   parsed.data.filename,
  })
}
