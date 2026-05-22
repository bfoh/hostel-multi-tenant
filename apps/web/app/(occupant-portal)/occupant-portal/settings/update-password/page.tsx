'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { KeyRound, Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react'

export default function UpdatePasswordPage() {
  const router = useRouter()

  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [showPw,    setShowPw]    = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [done,      setDone]      = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error: updateErr } = await supabase.auth.updateUser({ password })
      if (updateErr) throw new Error(updateErr.message)
      setDone(true)
      setTimeout(() => router.push('/occupant-portal'), 2500)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <div>
          <p className="text-lg font-semibold text-slate-800">Password updated!</p>
          <p className="mt-1 text-sm text-slate-500">Redirecting you back to your profile…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-2">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-slate-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_28px_-18px_rgba(16,24,40,0.20)]">

        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
            <KeyRound className="h-7 w-7 text-slate-500" />
          </div>
          <h1 className="text-[18px] font-bold tracking-tight text-slate-900">Set new password</h1>
          <p className="mt-1 text-[13px] text-slate-500">Choose a strong password for your account.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">New password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
                minLength={8}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-10 text-[14px] text-slate-800 outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
              <button
                type="button"
                onClick={() => setShowPw(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">Confirm password</label>
            <input
              type={showPw ? 'text' : 'password'}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repeat new password"
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[14px] text-slate-800 outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3.5 text-[14px] font-bold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update password'}
          </button>
        </form>

      </div>
    </div>
  )
}
