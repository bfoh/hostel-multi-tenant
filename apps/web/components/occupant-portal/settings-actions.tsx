'use client'

import { useState } from 'react'
import {
  KeyRound, ChevronRight, Loader2, CheckCircle2, Mail,
  HelpCircle, MessageSquare, Phone,
} from 'lucide-react'

interface Props {
  color:        string
  supportPhone: string | null
  supportEmail: string | null
  hostelName:   string
}

export function SettingsActions({ color, supportPhone, supportEmail, hostelName }: Props) {
  const [pwState, setPwState] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [pwError, setPwError] = useState('')

  async function requestPasswordReset() {
    setPwState('loading')
    setPwError('')
    try {
      const res = await fetch('/api/occupant/settings/reset-password', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to send reset email')
      setPwState('sent')
    } catch (e: any) {
      setPwError(e.message)
      setPwState('error')
    }
  }

  return (
    <div className="space-y-3">

      {/* ── Security ─────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Security</p>
        </div>

        <div>
          {pwState === 'sent' ? (
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-emerald-700">Reset email sent!</p>
                <p className="text-xs text-slate-400 mt-0.5">Check your inbox for a link to set a new password.</p>
              </div>
            </div>
          ) : (
            <button
              onClick={requestPasswordReset}
              disabled={pwState === 'loading'}
              className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${color}15` }}
              >
                {pwState === 'loading'
                  ? <Loader2 className="h-4 w-4 animate-spin" style={{ color }} />
                  : <KeyRound className="h-4 w-4" style={{ color }} />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">Change password</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {pwState === 'error' ? (
                    <span className="text-red-500">{pwError}</span>
                  ) : (
                    'A reset link will be sent to your email'
                  )}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
            </button>
          )}
        </div>
      </section>

      {/* ── Help & Support ───────────────────────────────────────── */}
      {(supportPhone || supportEmail) && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Help & Support</p>
          </div>
          <div className="divide-y divide-slate-100">
            {supportPhone && (
              <a
                href={`tel:${supportPhone}`}
                className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-slate-50"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                  <Phone className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">Call reception</p>
                  <p className="text-xs text-slate-400 mt-0.5">{supportPhone}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
              </a>
            )}
            {supportEmail && (
              <a
                href={`mailto:${supportEmail}`}
                className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-slate-50"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                  <Mail className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">Email us</p>
                  <p className="text-xs text-slate-400 mt-0.5">{supportEmail}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
              </a>
            )}
          </div>
        </section>
      )}

      {/* ── About ────────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">About</p>
        </div>
        <div className="divide-y divide-slate-100">
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50">
              <HelpCircle className="h-4 w-4 text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">{hostelName} Resident Portal</p>
              <p className="text-xs text-slate-400 mt-0.5">
                For account issues (email / ID changes) contact hostel management directly.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50">
              <MessageSquare className="h-4 w-4 text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">Feedback</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Having issues with the portal? Let the front desk know.
              </p>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
