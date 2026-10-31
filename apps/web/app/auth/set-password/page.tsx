'use client'

/**
 * /auth/set-password
 *
 * Lands here after a magic-link sign-in (staff or owner who was invited but
 * hasn't picked a password yet). The user already has an active Supabase
 * session at this point — we just need to attach a password and forward them
 * to their actual portal.
 *
 * The `?next=` query param controls the post-set destination so the same
 * page works for /dashboard, /staff-portal, /occupant-portal, etc.
 */

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PasswordInput } from '@/components/ui/password-input'
import {
  AuthAlert,
  AuthHeading,
  AuthLoading,
  AuthPage,
  authInputClass,
  authLabelClass,
  authPrimaryButtonClass,
} from '@/components/auth/auth-ui'

export default function SetPasswordPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const next         = searchParams.get('next') || '/dashboard'

  const [email,    setEmail]    = useState<string>('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [error,    setError]    = useState('')
  const [busy,     setBusy]     = useState(false)
  const [ready,    setReady]    = useState(false)

  // Make sure the user actually has a session before showing the form.
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        // No session — bounce back to login. Preserve next so they can come
        // back here after they get a fresh invite.
        window.location.href = `/login?next=${encodeURIComponent(`/auth/set-password?next=${encodeURIComponent(next)}`)}`
        return
      }
      setEmail(user.email ?? '')
      setReady(true)
    })
  }, [next])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (!/[A-Z]/.test(password)) { setError('Include at least one uppercase letter.'); return }
    if (!/[0-9]/.test(password)) { setError('Include at least one number.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }

    setBusy(true)
    try {
      const supabase = createClient()
      const { error: updateErr } = await supabase.auth.updateUser({ 
        password,
        data: { must_change_password: false }
      })
      if (updateErr) throw updateErr
      // Hard navigation so middleware re-reads the session cookies fresh.
      window.location.href = next
    } catch (err: any) {
      setError(err?.message ?? 'Could not set password. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!ready) return <AuthLoading />

  return (
    <AuthPage>
      <div className="space-y-5">
        <AuthHeading
          title="Set a password"
          subtitle={
            <>
              You&apos;re signed in as <span className="font-semibold text-bd-ink">{email}</span>. Pick a
              password so you can log in directly next time.
            </>
          }
        />

        <form onSubmit={submit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="password" className={`${authLabelClass} mb-1.5`}>New password</label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Create a password"
              aria-describedby="password-hint"
              className={authInputClass}
            />
            <p id="password-hint" className="mt-1.5 text-[13px] text-bd-slate">
              At least 8 characters, with one uppercase letter and one number.
            </p>
          </div>

          <div>
            <label htmlFor="confirm" className={`${authLabelClass} mb-1.5`}>Confirm password</label>
            <PasswordInput
              id="confirm"
              autoComplete="new-password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Re-enter your password"
              className={authInputClass}
            />
          </div>

          {error && <AuthAlert>{error}</AuthAlert>}

          <button type="submit" disabled={busy} className={authPrimaryButtonClass}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {busy ? 'Saving…' : 'Save password and continue'}
          </button>
        </form>
      </div>
    </AuthPage>
  )
}
