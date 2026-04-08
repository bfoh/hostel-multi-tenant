import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Supabase Auth callback handler.
 * Called after:
 *   - Email confirmation (signup)
 *   - Magic link login
 *   - Password reset (redirects to /reset-password)
 *   - OAuth callback
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  const type = searchParams.get('type') // 'recovery' for password reset

  if (code) {
    const response = NextResponse.redirect(
      new URL(type === 'recovery' ? '/reset-password' : next, origin)
    )

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return response
    }
  }

  // Invalid or expired link
  return NextResponse.redirect(new URL('/login?error=link_expired', origin))
}
