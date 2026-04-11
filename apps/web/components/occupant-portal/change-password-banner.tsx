'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { KeyRound, X } from 'lucide-react'

const STORAGE_KEY = 'occ_pw_banner_dismissed'

/**
 * Shown to occupants who have not yet dismissed the "change your password" reminder.
 * Dismissed state persists in localStorage so it doesn't reappear after dismissal.
 */
export function ChangePasswordBanner({ createdAt }: { createdAt: string }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Only show if account is ≤ 30 days old AND not already dismissed
    const ageMs  = Date.now() - new Date(createdAt).getTime()
    const fresh  = ageMs < 30 * 24 * 60 * 60 * 1000
    const dismissed = localStorage.getItem(STORAGE_KEY) === 'true'
    if (fresh && !dismissed) setVisible(true)
  }, [createdAt])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, 'true')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
      <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <div className="flex-1">
        <p className="font-semibold text-amber-800">Change your default password</p>
        <p className="mt-0.5 text-amber-700">
          You&apos;re using the temporary password sent to your phone. Please set a personal password now.
        </p>
        <Link
          href="/occupant-portal/settings/update-password"
          onClick={dismiss}
          className="mt-2 inline-block rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
        >
          Change password →
        </Link>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 text-amber-400 hover:text-amber-600"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
