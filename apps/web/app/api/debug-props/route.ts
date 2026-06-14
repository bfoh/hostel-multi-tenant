import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/debug-props  — temporary. Returns the property KEYS that
 * generateLink('signup') yields (no token values), to confirm whether
 * hashed_token is present. Delete after.
 */
export async function GET(req: NextRequest) {
  const admin  = createAdminClient()
  const host   = req.headers.get('host') ?? ''
  const proto  = host.includes('localhost') ? 'http' : 'https'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`

  const throwaway = `debug-props-${Date.now()}@gh-hostels.com`
  const { data, error } = await admin.auth.admin.generateLink({
    type:     'signup',
    email:    throwaway,
    password: `Dbg-${Date.now()}-Aa1!`,
    options:  { redirectTo: `${appUrl}/auth/callback` },
  })

  const props = (data?.properties ?? {}) as Record<string, unknown>
  const out = {
    error:             error?.message ?? null,
    property_keys:     Object.keys(props),
    has_hashed_token:  !!props.hashed_token,
    has_action_link:   !!props.action_link,
    verification_type: props.verification_type ?? null,
    action_link_host:  typeof props.action_link === 'string' ? new URL(props.action_link).host : null,
  }

  if (data?.user?.id) await admin.auth.admin.deleteUser(data.user.id).catch(() => {})

  return NextResponse.json(out)
}
