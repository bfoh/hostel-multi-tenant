'use client'

import { useState } from 'react'
import { Mail, Loader2, CheckCircle2, RefreshCw } from 'lucide-react'

export function InviteStaffButton({ staffId, hasEmail, hasAccount, compact }: {
  staffId: string
  hasEmail: boolean
  hasAccount: boolean
  compact?: boolean
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function invite() {
    if (!hasEmail) {
      setMessage('Add an email address to this staff member first.')
      setStatus('error')
      return
    }
    setStatus('loading')
    try {
      const res = await fetch(`/api/staff/${staffId}/invite`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setStatus('done')
      setMessage(data.message)
    } catch (e: any) {
      setStatus('error')
      setMessage(e.message)
    }
  }

  if (status === 'done') {
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-success/20 bg-success-subtle px-3 py-1.5 text-xs font-medium text-success">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {message}
      </span>
    )
  }

  const label = hasAccount
    ? (compact ? 'Resend' : 'Resend portal access')
    : (compact ? 'Invite' : 'Send portal access')

  const Icon = status === 'loading'
    ? Loader2
    : (hasAccount ? RefreshCw : Mail)

  return (
    <div className="flex items-center gap-2">
      {hasAccount && (
        <span className="flex items-center gap-1.5 rounded-full border border-success/20 bg-success-subtle px-3 py-1.5 text-xs font-medium text-success">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {compact ? 'Active' : 'Portal access active'}
        </span>
      )}
      <div className="flex flex-col items-end gap-1">
        <button
          onClick={invite}
          disabled={status === 'loading'}
          className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-raised transition-colors disabled:opacity-60"
        >
          <Icon className={`h-3.5 w-3.5 ${status === 'loading' ? 'animate-spin' : ''}`} />
          {label}
        </button>
        {status === 'error' && (
          <p className="text-[11px] text-danger">{message}</p>
        )}
      </div>
    </div>
  )
}
