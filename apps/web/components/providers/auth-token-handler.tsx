'use client'

/**
 * Global fallback handler for Supabase invite / magic-link hash tokens.
 *
 * When the Supabase redirect URL isn't configured and the token lands on the
 * wrong page (e.g. /dashboard), this component detects the hash and redirects
 * to /auth/invite so the dedicated handler can finish the flow.
 *
 * It deliberately does NOT process the token itself — it just hands off to
 * /auth/invite, which calls setSession() and redirects to the right portal.
 * It also skips /auth/invite to avoid double-processing.
 */

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export function AuthTokenHandler() {
  const router   = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Let /auth/invite handle its own tokens
    if (pathname === '/auth/invite') return

    const hash = window.location.hash
    if (!hash.includes('access_token=')) return

    // Forward to /auth/invite with the full hash so it can do the exchange
    router.replace('/auth/invite' + hash)
  }, [pathname, router])

  return null
}
