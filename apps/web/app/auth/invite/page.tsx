'use client'

/**
 * /auth/invite — landing page for Supabase invite emails.
 *
 * Supabase invite emails embed the session as a URL hash fragment
 * (#access_token=...&refresh_token=...). Server components cannot read
 * hash fragments, so this client component handles the exchange.
 *
 * It calls setSession() directly — more reliable than onAuthStateChange
 * because it works even when a different user is already logged in
 * (e.g. admin testing the occupant invite link on the same browser).
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

export default function InvitePage() {
  const router = useRouter()
  const [error, setError] = useState('')

  useEffect(() => {
    const hash = window.location.hash.substring(1)
    const params       = new URLSearchParams(hash)
    const accessToken  = params.get('access_token')
    const refreshToken = params.get('refresh_token')

    if (!accessToken || !refreshToken) {
      setError('This invite link is missing required tokens. Please ask your hostel manager to resend the invite.')
      return
    }

    const supabase = createClient()

    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(async ({ data: { session }, error: sessionError }) => {
        if (sessionError || !session) {
          setError('This invite link has expired or has already been used. Please ask your hostel manager to resend the invite.')
          return
        }

        // Clear the hash so it isn't reprocessed on refresh
        window.history.replaceState(null, '', window.location.pathname)

        // The invite token was minted before the occupant row had user_id set,
        // so the JWT hook couldn't inject tenant_id/tenant_name at that time.
        // Refreshing the session triggers the hook again now that the occupant
        // is linked — the new JWT will carry the correct tenant claims.
        const { data: { session: refreshed } } = await supabase.auth.refreshSession()

        const portalType = session.user.user_metadata?.portal_type

        // Resolve the correct base URL for this tenant so the user lands on
        // their hostel's domain, not the generic platform domain.
        // JWT claims carry tenant_domain (custom domain) and tenant_slug as fallback.
        const claims      = refreshed?.access_token
          ? JSON.parse(atob(refreshed.access_token.split('.')[1]))
          : {}
        const tenantDomain = claims?.tenant_domain as string | undefined  // e.g. "app.myhostel.com"
        const tenantSlug   = claims?.tenant_slug   as string | undefined
        const appDomain    = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'gh-hostels.com'
        const currentHost  = window.location.hostname

        // Only redirect cross-domain if we're on the platform root
        const onPlatformRoot =
          currentHost === appDomain ||
          currentHost === `app.${appDomain}` ||
          currentHost === 'gh-hostels.com'

        let tenantBase = ''
        if (onPlatformRoot) {
          if (tenantDomain) {
            tenantBase = `https://${tenantDomain}`
          } else if (tenantSlug) {
            tenantBase = `https://${tenantSlug}.${appDomain}`
          }
        }

        // Use a hard navigation so the browser sends a fresh HTTP request,
        // ensuring middleware reads the newly-set session cookies.
        if (portalType === 'occupant') {
          window.location.href = `${tenantBase}/occupant-portal/settings/update-password`
        } else if (portalType === 'staff') {
          window.location.href = `${tenantBase}/staff-portal`
        } else {
          window.location.href = `${tenantBase}/dashboard`
        }
      })
  }, [router])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-raised px-4">
        <div className="max-w-sm w-full rounded-2xl border border-border bg-surface p-8 text-center space-y-4 shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-danger-subtle">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="text-lg font-bold text-text-primary">Invite link expired</h1>
          <p className="text-sm text-text-secondary leading-relaxed">{error}</p>
          <a
            href="/login"
            className="inline-block rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover transition-colors"
          >
            Back to sign in
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-raised">
      <div className="text-center space-y-3">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand" />
        <p className="text-sm font-medium text-text-secondary">Setting up your account…</p>
      </div>
    </div>
  )
}
