'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Loader2, Users, Mail, MessageSquare, Bell } from 'lucide-react'

const TARGETS = [
  { value: 'all',            label: 'All active occupants',   desc: 'Pending, confirmed & checked-in' },
  { value: 'checked_in',    label: 'Currently checked in',    desc: 'Only occupants in residence now' },
  { value: 'confirmed',     label: 'Confirmed & checked in',  desc: 'Upcoming + current occupants' },
  { value: 'overdue_balance', label: 'Overdue balance',       desc: 'Checked-in with unpaid balance' },
]

const CHANNELS = [
  { value: 'sms',   label: 'SMS',   icon: MessageSquare },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'push',  label: 'Push',  icon: Bell },
]

export function BroadcastForm({ hasSms, hasEmail, hasPush }: {
  hasSms: boolean
  hasEmail: boolean
  hasPush: boolean
}) {
  const router = useRouter()
  const [target,   setTarget]   = useState('all')
  const [channels, setChannels] = useState<string[]>(['sms'])
  const [subject,  setSubject]  = useState('')
  const [message,  setMessage]  = useState('')
  const [sending,  setSending]  = useState(false)
  const [result,   setResult]   = useState<{ recipients: number; results: Record<string, number> } | null>(null)
  const [error,    setError]    = useState<string | null>(null)

  function toggleChannel(ch: string) {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    )
  }

  async function send() {
    if (!message.trim()) { setError('Message is required'); return }
    if (channels.length === 0) { setError('Select at least one channel'); return }
    setSending(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/communications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, channels, subject, message }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Broadcast failed')
      setResult({ recipients: data.recipients, results: data.results })
      setMessage('')
      setSubject('')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSending(false)
    }
  }

  const channelEnabled = { sms: hasSms, email: hasEmail, push: hasPush }

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="border-b border-border px-5 py-4 bg-surface-raised flex items-center gap-2">
        <Send className="h-4 w-4 text-text-tertiary" />
        <h2 className="font-semibold text-text-primary">Broadcast Message</h2>
      </div>

      <div className="p-5 space-y-5">
        {/* Target */}
        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
            <Users className="inline h-3.5 w-3.5 mr-1" />Recipients
          </label>
          <div className="grid grid-cols-2 gap-2">
            {TARGETS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTarget(t.value)}
                className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                  target === t.value
                    ? 'border-brand bg-brand/5 text-brand'
                    : 'border-border text-text-secondary hover:border-brand/30 hover:text-text-primary'
                }`}
              >
                <p className="text-sm font-medium">{t.label}</p>
                <p className="text-xs opacity-70">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Channels */}
        <div>
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
            Channels
          </label>
          <div className="flex gap-2">
            {CHANNELS.map(({ value, label, icon: Icon }) => {
              const enabled = channelEnabled[value as keyof typeof channelEnabled]
              const active  = channels.includes(value)
              return (
                <button
                  key={value}
                  onClick={() => enabled && toggleChannel(value)}
                  disabled={!enabled}
                  title={!enabled ? `${label} not configured` : undefined}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors
                    ${active && enabled ? 'border-brand bg-brand/5 text-brand' : ''}
                    ${!enabled ? 'opacity-40 cursor-not-allowed border-border text-text-tertiary' : ''}
                    ${!active && enabled ? 'border-border text-text-secondary hover:border-brand/30 hover:text-text-primary' : ''}
                  `}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                  {!enabled && <span className="text-[10px]">(not set)</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* Subject (email only) */}
        {channels.includes('email') && (
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Email subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Important notice from the hostel"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
        )}

        {/* Message */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message here…"
            rows={4}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand resize-none"
          />
          {channels.includes('sms') && (
            <p className="text-[11px] text-text-tertiary mt-1">{message.length} chars · {Math.ceil(message.length / 160)} SMS page{Math.ceil(message.length / 160) !== 1 ? 's' : ''}</p>
          )}
        </div>

        {error && (
          <p className="rounded-lg bg-danger/5 border border-danger/20 px-3 py-2 text-sm text-danger">{error}</p>
        )}

        {result && (
          <div className="rounded-lg bg-success/5 border border-success/20 px-4 py-3 text-sm text-success">
            Sent to {result.recipients} recipients
            {Object.entries(result.results)
              .filter(([k]) => ['sms', 'email', 'push'].includes(k))
              .map(([k, v]) => v > 0 ? ` · ${v} ${k}` : '')
              .join('')}
          </div>
        )}

        <button
          onClick={send}
          disabled={sending || channels.length === 0}
          className="flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover disabled:opacity-50 transition-colors"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {sending ? 'Sending…' : 'Send broadcast'}
        </button>
      </div>
    </div>
  )
}
