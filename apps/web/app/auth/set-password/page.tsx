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

const FROST = 'rgba(214,235,253,0.19)'

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
      const { error: updateErr } = await supabase.auth.updateUser({ password })
      if (updateErr) throw updateErr
      // Hard navigation so middleware re-reads the session cookies fresh.
      window.location.href = next
    } catch (err: any) {
      setError(err?.message ?? 'Could not set password. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="h-6 w-6 animate-spin text-white/70" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 py-12">
      <div
        className="w-full max-w-md rounded-2xl bg-black/60 p-8 text-[#f0f0f0] backdrop-blur-xl"
        style={{ border: `1px solid ${FROST}` }}
      >
        <div className="space-y-2 text-center">
          <h1 className="text-[22px] font-semibold tracking-[-0.5px] text-white">Set a password</h1>
          <p className="text-[13px] text-[#a1a4a5]">
            You&apos;re signed in as <span className="text-white">{email}</span>. Pick a password
            so you can log in directly next time.
          </p>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-[13px] font-medium text-[#a1a4a5]">New password</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min. 8 characters, one uppercase, one number"
              className="w-full rounded-xl border bg-white/[0.04] px-4 py-3 text-[14px] text-[#f0f0f0] placeholder:text-[#464a4d] focus:outline-none focus:border-[#3b9eff]/50"
              style={{ borderColor: FROST }}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirm" className="text-[13px] font-medium text-[#a1a4a5]">Confirm password</label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border bg-white/[0.04] px-4 py-3 text-[14px] text-[#f0f0f0] placeholder:text-[#464a4d] focus:outline-none focus:border-[#3b9eff]/50"
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
            disabled={busy}
            className="w-full rounded-full bg-white px-4 py-3 text-[14px] font-semibold text-black transition-all hover:bg-white/90 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save password and continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
