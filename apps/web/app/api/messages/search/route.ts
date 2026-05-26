/**
 * GET /api/messages/search?q=<text>&limit=20
 *
 * Returns matching messages across conversations the caller participates in.
 * Uses the FTS index on `messages.body` (gin to_tsvector simple).
 */
import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'

const MAX = 20

export async function GET(req: NextRequest) {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  if (!q) return NextResponse.json({ results: [] })

  const limit = Math.min(MAX, parseInt(req.nextUrl.searchParams.get('limit') ?? String(MAX), 10))

  const admin = await createTenantAdminClientFromHeaders() as any

  // Conversations the caller belongs to (RLS would also enforce this, but
  // we filter explicitly to constrain the index scan).
  const { data: parts } = await admin
    .from('conversation_participants')
    .select('conversation_id')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
  const convIds = ((parts ?? []) as any[]).map(p => p.conversation_id as string)
  if (convIds.length === 0) return NextResponse.json({ results: [] })

  const { data, error } = await admin
    .from('messages')
    .select('id, conversation_id, sender_id, body, created_at')
    .in('conversation_id', convIds)
    .is('deleted_at', null)
    .ilike('body', `%${q}%`)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ results: data ?? [] })
}
