'use client'

import { useState } from 'react'
import { KeyRound, Loader2, CheckCircle2, RefreshCw } from 'lucide-react'

export function SendCredentialsButton({ occupantId, hasEmail, hasAccount }: {
  occupantId: string
  hasEmail: boolean
  hasAccount: boolean
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function send() {
    if (!hasEmail) {
      setMessage('Add an email address to this occupant first.')
      setStatus('error')
      return
    }
    setStatus('loading')
    try {
      const res = await fetch(`/api/occupants/${occupantId}/send-credentials`, { method: 'POST' })
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
      <span className="flex items-center gap-1.5 rounded-full border border-success/20 bg-success-subtle px-2.5 py-0.5 text-xs font-medium text-success">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {message}
      </span>
    )
  }

  const label = hasAccount ? 'Resend portal access' : 'Send portal access'
  const Icon  = status === 'loading'
    ? Loader2
    : (hasAccount ? RefreshCw : KeyRound)

  return (
    <div className="flex items-center gap-2">
      {hasAccount && (
        <span className="flex items-center gap-1.5 rounded-full border border-success/20 bg-success-subtle px-2.5 py-0.5 text-xs font-medium text-success">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Portal access active
        </span>
      )}
      <div className="flex flex-col items-start gap-1">
        <button
          onClick={send}
          disabled={status === 'loading'}
          className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface-raised transition-colors disabled:opacity-60"
        >
          <Icon className={`h-4 w-4 ${status === 'loading' ? 'animate-spin' : ''}`} />
          {label}
        </button>
        {status === 'error' && (
          <p className="text-xs text-danger">{message}</p>
        )}
      </div>
    </div>
  )
}
