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

const FROST = 'rgba(214,235,253,0.19)'

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

      const onPlatformRoot =
        currentHost === appDomain || currentHost === `app.${appDomain}` || currentHost === 'gh-hostels.com'

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
    <div className="flex min-h-screen items-center justify-center bg-black px-4 py-12">
      <div
        className="w-full max-w-md rounded-2xl bg-black/60 p-8 text-[#f0f0f0] backdrop-blur-xl"
        style={{ border: `1px solid ${FROST}` }}
      >
        <div className="space-y-2 text-center">
          <h1 className="text-[22px] font-semibold tracking-[-0.5px] text-white">Enter your code</h1>
          <p className="text-[13px] text-[#a1a4a5]">
            We emailed a 6-digit code to your inbox. Enter it below to finish setup.
          </p>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-[13px] font-medium text-[#a1a4a5]">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border bg-white/[0.04] px-4 py-3 text-[14px] text-[#f0f0f0] placeholder:text-[#464a4d] focus:outline-none focus:border-[#3b9eff]/50"
              style={{ borderColor: FROST }}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="code" className="text-[13px] font-medium text-[#a1a4a5]">Code</label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoFocus={!!email}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full rounded-xl border bg-white/[0.04] px-4 py-3 text-center text-[20px] tracking-[0.5em] font-mono text-white placeholder:text-[#464a4d] focus:outline-none focus:border-[#3b9eff]/50"
              style={{ borderColor: FROST }}
            />
          </div>

          {error && (
            <div
              className="rounded-xl px-4 py-3 text-[13px] text-[#ff2047]"
              style={{ border: '1px solid rgba(255,32,71,0.2)', background: 'rgba(255,32,71,0.06)' }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="w-full rounded-full bg-white px-4 py-3 text-[14px] font-semibold text-black transition-all hover:bg-white/90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Verify and continue'}
          </button>
        </form>

        <p className="mt-6 text-center text-[12px] text-[#464a4d]">
          Didn&apos;t get a code? Ask your hostel manager to resend the invitation.
        </p>
      </div>
    </div>
  )
}
