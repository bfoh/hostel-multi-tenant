import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/push/register
 * Save / refresh a native device push token for the authenticated user.
 * Called by the Capacitor mobile shell after `@capacitor/push-notifications`
 * registers with APNs / FCM.
 *
 * Body: { token: string, platform: 'ios' | 'android', app_version?: string }
 *
 * Native push only — browser web-push uses /api/push/subscribe and the
 * separate push_subscriptions table.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const headersList = await headers()
  const tenantId    = headersList.get('x-tenant-id')

  const body = await req.json().catch(() => null) as
    | { token?: unknown; platform?: unknown; app_version?: unknown }
    | null

  const token       = typeof body?.token === 'string' ? body.token.trim() : ''
  const platform    = body?.platform
  const appVersion  = typeof body?.app_version === 'string' ? body.app_version : null

  if (token.length < 10) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }
  if (platform !== 'ios' && platform !== 'android') {
    return NextResponse.json({ error: 'platform must be ios or android' }, { status: 400 })
  }

  const { error } = await (supabase.from('device_push_tokens') as any).upsert({
    user_id:      user.id,
    tenant_id:    tenantId,
    platform,
    token,
    app_version:  appVersion,
    last_seen_at: new Date().toISOString(),
  }, { onConflict: 'token' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
