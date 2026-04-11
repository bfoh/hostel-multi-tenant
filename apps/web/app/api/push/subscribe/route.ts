import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/push/subscribe
 * Save a browser push subscription for the authenticated user.
 * Body: { endpoint, keys: { p256dh, auth } }
 *
 * DELETE /api/push/subscribe
 * Remove a subscription by endpoint.
 * Body: { endpoint }
 */

export async function POST(req: NextRequest) {
  const headersList = await headers()
  const tenantId    = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { endpoint, keys } = body
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription object' }, { status: 400 })
  }

  await (supabase.from('push_subscriptions') as any).upsert({
    tenant_id: tenantId,
    user_id:   user.id,
    endpoint,
    p256dh:    keys.p256dh,
    auth_key:  keys.auth,
    user_agent: req.headers.get('user-agent') ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'tenant_id,user_id,endpoint' })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const headersList = await headers()
  const tenantId    = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { endpoint } = await req.json()
  if (!endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })

  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .eq('endpoint', endpoint)

  return NextResponse.json({ ok: true })
}
