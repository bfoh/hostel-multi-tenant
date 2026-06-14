import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'

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

  // Idempotent: check if user already has a tenant
  const { data: existing } = await admin
    .from('tenant_members')
    .select('tenant_id, tenants(id, slug)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  let slug: string

  if (existing?.tenant_id) {
    const t = Array.isArray(existing.tenants) ? existing.tenants[0] : existing.tenants
    slug = (t as any)?.slug ?? ''
  } else {
    // Brand new user — create tenant
    const rawName: string = (user.user_metadata?.hostel_name as string) || ''
    const hostelName = rawName.trim() || 'My Hostel'

    const baseSlug = hostelName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'hostel'

    // Ensure uniqueness
    slug = baseSlug
    let attempt = 0
    while (true) {
      const { data: taken } = await admin.from('tenants').select('id').eq('slug', slug).maybeSingle()
      if (!taken) break
      attempt++
      slug = `${baseSlug}-${attempt}`
    }

    const { data: tenant, error: tenantErr } = await admin
      .from('tenants')
      .insert({ name: hostelName, slug, status: 'trial', onboarding_completed: false })
      .select('id, slug')
      .single()

    if (tenantErr || !tenant) {
      // Fall back to onboarding on current domain and let wizard handle it
      return response
    }

    await admin.from('tenant_members').insert({
      tenant_id: tenant.id,
      user_id:   user.id,
      role:      'owner',
      is_active: true,
      joined_at: new Date().toISOString(),
    })

    slug = tenant.slug
  }

  // ── Redirect to tenant subdomain for onboarding ────────────────────────────
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'gh-hostels.com'
  const hostname  = request.headers.get('host') ?? ''
  const isLocalhost = hostname.includes('localhost')

  if (!isLocalhost && slug) {
    // Production: redirect to slug.domain.com/onboarding
    return NextResponse.redirect(`https://${slug}.${appDomain}/onboarding`)
  }

  // Localhost: stay on current origin, middleware will resolve tenant via DB
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
