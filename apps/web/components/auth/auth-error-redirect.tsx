'use client'

import { useEffect } from 'react'

/**
 * If a user lands on a page (typically the marketing root) with an auth error
 * hash like `#error=access_denied&error_code=otp_expired&...`, immediately
 * forward them to /auth/invite so they see the friendly "invite link expired"
 * UI rather than a confusing marketing page with a cryptic URL.
 *
 * Supabase appends the hash when its /auth/v1/verify endpoint redirects after
 * a failed token exchange, and the redirect target is governed by the
 * project's Site URL — which is the platform root, not /auth/invite.
 */
export function AuthErrorRedirect() {
  useEffect(() => {
    const hash = window.location.hash
    if (!hash || hash.length < 2) return

    const params = new URLSearchParams(hash.slice(1))
    const hasError = params.has('error') || params.has('error_code')
    if (!hasError) return

    const target = `/auth/invite${hash}`
    window.location.replace(target)
  }, [])

  return null
}
