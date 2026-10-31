'use client'

/**
 * /auth/verify-otp
 *
 * Scanner-safe alternative to clickable Supabase magic links. Email clients
 * (Gmail, Outlook) pre-fetch URLs to scan for malware, which burns the
 * single-use token before the human clicks. We email a 6-digit code instead
 * — bots don't type codes into a form, so the code survives until the user
 * arrives. Once they enter it, we call supabase.auth.verifyOtp() which
 * exchanges the code for a session, then forwards to /auth/set-password.
 *
 * The email can be passed via `?email=` so the user just needs to paste the
 * code.
 */

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  AuthAlert,
  AuthHeading,
  AuthPage,
  authInputClass,
  authLabelClass,
  authPrimaryButtonClass,
} from '@/components/auth/auth-ui'

export default function VerifyOtpPage() {
  const searchParams = useSearchParams()
  const initialEmail = searchParams.get('email') ?? ''
  const initialCode  = searchParams.get('code')  ?? ''

  const [email, setEmail] = useState(initialEmail)
  const [code,  setCode]  = useState(initialCode)
  const [busy,  setBusy]  = useState(false)
  const [error, setError] = useState('')

  // If both email and code were prefilled, auto-submit. Skips the form for
  // users who clicked a link with all params.
  useEffect(() => {
    if (initialEmail && initialCode && initialCode.length === 6) {
      void verify(initialEmail, initialCode)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function verify(emailValue: string, codeValue: string) {
    setBusy(true)
    setError('')
    try {
      const supabase = createClient()
      const { data, error: verifyErr } = await supabase.auth.verifyOtp({
        email: emailValue.trim(),
        token: codeValue.trim(),
        type:  'magiclink',
      })
      if (verifyErr || !data.session) {
        throw new Error(verifyErr?.message ?? 'Invalid or expired code.')
      }

      // Refresh so the JWT picks up the tenant claims now that we're signed in.
      const { data: refreshed } = await supabase.auth.refreshSession()
      const accessToken = refreshed.session?.access_token ?? data.session.access_token
      const claims = accessToken
        ? JSON.parse(atob(accessToken.split('.')[1]))
        : {}
      const portalType   = (data.user as any)?.user_metadata?.portal_type
      const tenantDomain = claims?.tenant_domain as string | undefined
      const tenantSlug   = claims?.tenant_slug   as string | undefined
      const appDomain    = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'gh-hostels.com'
      const currentHost  = window.location.hostname

      // Excludes app.<domain>: the Capacitor mobile shell is locked to that
      // single fixed host (see lib/auth/mobile-context.ts) and its WKWebView
      // hands cross-origin navigations off to the system browser, which has
      // no session on the tenant subdomain and bounces to its own /login.
      const onPlatformRoot =
        currentHost === appDomain || currentHost === 'gh-hostels.com'

      let tenantBase = ''
      if (onPlatformRoot) {
        if (tenantDomain)    tenantBase = `https://${tenantDomain}`
        else if (tenantSlug) tenantBase = `https://${tenantSlug}.${appDomain}`
      }

      const finalDest =
        portalType === 'occupant' ? '/occupant-portal'
        : portalType === 'staff'  ? '/staff-portal'
        : '/dashboard'

      // If we resolved a tenant on a different host than this one, replay the
      // session by re-running verifyOtp on that origin. We pass the raw code
      // again — verifyOtp on Supabase is single-use, so the FIRST consumption
      // (this one) burned the token; the redirect target relies on the
      // refresh_token cookie that setSession will set on the new origin via
      // ?xfer=1, which we treat as "already authenticated, just plant cookies".
      const targetHost = tenantBase ? new URL(tenantBase).host : currentHost
      if (tenantBase && targetHost !== currentHost && refreshed.session) {
        const at = refreshed.session.access_token
        const rt = refreshed.session.refresh_token
        // Forward via /auth/invite hash so existing setSession handler runs on
        // the tenant origin and plants cookies there.
        window.location.href =
          `${tenantBase}/auth/invite?xfer=1#access_token=${encodeURIComponent(at)}&refresh_token=${encodeURIComponent(rt)}`
        return
      }

      const baseForFinal = tenantBase || ''
      window.location.href = `${baseForFinal}/auth/set-password?next=${encodeURIComponent(finalDest)}`
    } catch (err: any) {
      setError(err?.message ?? 'Invalid or expired code.')
    } finally {
      setBusy(false)
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || code.length !== 6) {
      setError('Enter your email and the 6-digit code from the invitation email.')
      return
    }
    void verify(email, code)
  }

  return (
    <AuthPage>
      <div className="space-y-5">
        <AuthHeading
          title="Enter your code"
          subtitle="We emailed a 6-digit code to your inbox. Enter it below to finish setup."
        />

        <form onSubmit={submit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className={`${authLabelClass} mb-1.5`}>Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={authInputClass}
            />
          </div>

          <div>
            <label htmlFor="code" className={`${authLabelClass} mb-1.5`}>Code</label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              autoFocus={!!email}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className={cn(authInputClass, 'text-center font-mono text-[20px] tracking-[0.5em] sm:text-[20px]')}
            />
          </div>

          {error && <AuthAlert>{error}</AuthAlert>}

          <button type="submit" disabled={busy || code.length !== 6} className={authPrimaryButtonClass}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {busy ? 'Verifying…' : 'Verify and continue'}
          </button>
        </form>

        <p className="text-center text-[14px] leading-relaxed text-bd-slate">
          Didn&apos;t get a code? Ask your property manager to resend the invitation.
        </p>
      </div>
    </AuthPage>
  )
}
