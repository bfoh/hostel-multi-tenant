import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'
import { provisionTenant } from '@/lib/onboarding/provision-tenant'

/**
 * Supabase Auth callback handler.
 * Called after:
 *   - Email confirmation (signup)
 *   - Magic link login
 *   - Password reset (redirects to /reset-password)
 *   - OAuth callback
 */
async function verifyAndRoute(
  request: NextRequest,
  code: string | null,
  tokenHash: string | null,
  type: string | null,
) {
  const { origin } = new URL(request.url)

  // We need a mutable response so Supabase can write session cookies
  const response = NextResponse.redirect(new URL('/onboarding', origin))
  const admin    = createAdminClient()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
          )
        },
      },
    }
  )

  // Admin-generated email links (signup confirmation, magic-link activation,
  // password recovery) carry a token_hash and must be verified with
  // verifyOtp — they are NOT PKCE, so exchangeCodeForSession would fail.
  // The OAuth/PKCE path still arrives with ?code=.
  const { error: exchangeError } = tokenHash
    ? await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type:       (type ?? 'email') as 'signup' | 'magiclink' | 'recovery' | 'email' | 'invite' | 'email_change',
      })
    : await supabase.auth.exchangeCodeForSession(code!)
  if (exchangeError) {
    return NextResponse.redirect(new URL('/login?error=link_expired', origin))
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', origin))
  }

  // Password reset — route to the correct reset page based on portal type
  if (type === 'recovery') {
    const { data: occupant } = await admin
      .from('occupants')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (occupant) {
      return NextResponse.redirect(new URL('/occupant-portal/settings/update-password', origin))
    }
    return NextResponse.redirect(new URL('/reset-password', origin))
  }

  // Occupant invite — skip tenant provisioning, send straight to portal
  if (user.user_metadata?.portal_type === 'occupant') {
    return NextResponse.redirect(new URL('/occupant-portal', origin))
  }

  // ── Provision tenant for new users ─────────────────────────────────────────

  let slug: string
  try {
    const rawBusinessType = user.user_metadata?.business_type
    const result = await provisionTenant({
      userId: user.id,
      rawName: user.user_metadata?.hostel_name as string | undefined,
      businessType: rawBusinessType === 'hotel' ? 'hotel' : 'hostel',
    })
    slug = result.slug
  } catch {
    // Fall back to onboarding on current domain and let wizard handle it
    return response
  }

  // The access token was minted during verification, BEFORE the owner
  // membership above existed — so it lacks the tenant_role claim and the app
  // would treat the owner as 'staff'. Refresh the session now so the new
  // token (via the JWT hook) carries tenant_role=owner.
  await supabase.auth.refreshSession()

  // ── Redirect to tenant subdomain for onboarding ────────────────────────────
  const appDomain = (process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'gh-hostels.com')
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
  const hostname  = request.headers.get('host') ?? ''
  const isLocalhost = hostname.includes('localhost')
  // The Capacitor mobile shell is locked to this single fixed host (no
  // subdomain resolution capability — see lib/auth/mobile-context.ts) and
  // its WKWebView treats a redirect to a different origin as an external
  // navigation, handing it off to the system browser instead of loading it
  // in-app. Keep app.<domain> requests on the current origin, same as
  // localhost — middleware already resolves tenant via JWT claims there.
  const isFixedAppHost = hostname === `app.${appDomain}`

  if (!isLocalhost && !isFixedAppHost && slug) {
    // Production: redirect to slug.domain.com/onboarding
    return NextResponse.redirect(`https://${slug}.${appDomain}/onboarding`)
  }

  // Localhost or the fixed app host: stay on current origin, middleware
  // will resolve tenant via DB / JWT claims
  return response
}

/**
 * GET — OAuth/PKCE callback (?code=). A token_hash arriving here (e.g. a stray
 * old link) is handed to /auth/confirm rather than verified inline, so email
 * scanners that prefetch the link can't burn the single-use token.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code      = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type      = searchParams.get('type')

  if (!code && !tokenHash) {
    return NextResponse.redirect(new URL('/login?error=link_expired', origin))
  }

  if (tokenHash && !code) {
    const url = new URL('/auth/confirm', origin)
    url.searchParams.set('token_hash', tokenHash)
    if (type) url.searchParams.set('type', type)
    return NextResponse.redirect(url)
  }

  return verifyAndRoute(request, code, null, type)
}

/**
 * POST — human-confirmed token_hash verification (from the /auth/confirm
 * button). Only a real user submit reaches here; scanner GETs do not.
 */
export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url)
  const form      = await request.formData()
  const tokenHash = (form.get('token_hash') as string | null) || null
  const type      = (form.get('type') as string | null) || null

  if (!tokenHash) {
    return NextResponse.redirect(new URL('/login?error=link_expired', origin))
  }

  return verifyAndRoute(request, null, tokenHash, type)
}
