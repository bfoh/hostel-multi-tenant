/**
 * GET /api/messages/attachments/url?path=conversations/<id>/<sender>/<uuid>.<ext>
 *
 * Issues a short-lived signed read URL for a message attachment. Authorises
 * the caller via participation in the conversation embedded in the path.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const SIGNED_TTL_SECONDS = 60 * 60

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'path required' }, { status: 422 })

  if (!path.startsWith('conversations/')) {
    return NextResponse.json({ error: 'invalid path' }, { status: 400 })
  }
  const conversationId = path.split('/')[1]
  if (!conversationId) return NextResponse.json({ error: 'invalid path' }, { status: 400 })

  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient() as any

  const { data: part } = await admin
    .from('conversation_participants')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!part) return NextResponse.json({ error: 'Not a participant' }, { status: 403 })

  const { data, error } = await admin.storage
    .from('messages')
    .createSignedUrl(path, SIGNED_TTL_SECONDS)
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'sign failed' }, { status: 500 })

  return NextResponse.json({ url: data.signedUrl, expires_in: SIGNED_TTL_SECONDS })
}
