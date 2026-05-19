'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Trash2, Send, Save, PauseCircle, PlayCircle } from 'lucide-react'

interface Recipient {
  name?:  string
  phone?: string | null
  email?: string | null
}

interface Channels {
  sms?:   boolean
  email?: boolean
  push?:  boolean
}

interface Initial {
  enabled:     boolean
  time:        string
  channels:    Channels
  recipients:  Recipient[]
  pausedUntil: string | null
}

interface Props {
  initial:  Initial
  primary:  { phone: string | null; email: string | null }
  timezone: string
}

export function DigestSettingsForm({ initial, primary, timezone }: Props) {
  const router = useRouter()
  const [enabled, setEnabled]       = useState(initial.enabled)
  const [time, setTime]             = useState(initial.time.slice(0, 5))
  const [channels, setChannels]     = useState<Channels>(initial.channels ?? {})
  const [recipients, setRecipients] = useState<Recipient[]>(initial.recipients ?? [])
  const [pausedUntil, setPausedUntil] = useState<string | null>(initial.pausedUntil)
  const [saving, setSaving]         = useState(false)
  const [testing, setTesting]       = useState(false)
  const [pausing, setPausing]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [savedAt, setSavedAt]       = useState<number | null>(null)
  const [testResult, setTestResult] = useState<string | null>(null)

  async function pause(days: number) {
    setPausing(true); setError(null)
    try {
      const res = await fetch('/api/settings/digest/pause', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ days }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Pause failed')
        return
      }
      setPausedUntil(data.paused_until)
      router.refresh()
    } finally { setPausing(false) }
  }

  async function resume() {
    setPausing(true); setError(null)
    try {
      const res = await fetch('/api/settings/digest/pause', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Resume failed')
        return
      }
      setPausedUntil(null)
      router.refresh()
    } finally { setPausing(false) }
  }

  const isPaused = !!(pausedUntil && new Date(pausedUntil).getTime() > Date.now())

  function setChannel(key: keyof Channels, value: boolean) {
    setChannels(c => ({ ...c, [key]: value }))
  }

  function addRecipient() {
    setRecipients(r => [...r, { name: '', phone: '', email: '' }])
  }
  function updateRecipient(i: number, patch: Partial<Recipient>) {
    setRecipients(r => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)))
  }
  function removeRecipient(i: number) {
    setRecipients(r => r.filter((_, idx) => idx !== i))
  }

  async function save() {
    setSaving(true); setError(null)
    try {
      const cleanRecipients = recipients
        .map(r => ({
          name:  r.name?.trim() || undefined,
          phone: r.phone?.trim() || null,
          email: r.email?.trim() || null,
        }))
        .filter(r => r.phone || r.email)

      const res = await fetch('/api/settings/digest', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          enabled,
          time:       `${time}:00`,
          channels,
          recipients: cleanRecipients,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Save failed')
        return
      }
      setRecipients(cleanRecipients)
      setSavedAt(Date.now())
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  async function sendTest() {
    setTesting(true); setError(null); setTestResult(null)
    try {
      const res = await fetch('/api/settings/digest/test', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Test failed')
        return
      }
      setTestResult(
        `Sent · SMS ${data.sms_sent} · Email ${data.email_sent} · Push ${data.push_sent}`
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Enabled */}
      <section className="rounded-xl border border-border bg-surface p-5 space-y-3">
        <label className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-text-primary">Send digest automatically</p>
            <p className="mt-0.5 text-xs text-text-secondary">
              Fires every day at the configured local time.
            </p>
          </div>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="mt-1 h-4 w-4"
          />
        </label>
      </section>

      {/* Pause */}
      <section className="rounded-xl border border-border bg-surface p-5 space-y-3">
        <p className="text-sm font-semibold text-text-primary">Vacation pause</p>
        {isPaused ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning-subtle/40 px-3 py-2 text-xs">
            <span className="flex items-center gap-2 text-warning-fg">
              <PauseCircle className="h-3.5 w-3.5" />
              Paused until {new Date(pausedUntil!).toLocaleString()}
            </span>
            <button
              type="button"
              onClick={resume}
              disabled={pausing}
              className="flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium hover:bg-surface-raised transition-colors disabled:opacity-60"
            >
              {pausing ? <Loader2 className="h-3 w-3 animate-spin" /> : <PlayCircle className="h-3 w-3" />}
              Resume now
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs text-text-secondary">
              Pause the digest temporarily without losing your settings.
            </p>
            <div className="flex flex-wrap gap-2">
              {[3, 7, 14, 30].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => pause(d)}
                  disabled={pausing}
                  className="flex items-center gap-1 rounded-md border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium hover:bg-surface-sunken transition-colors disabled:opacity-60"
                >
                  {pausing && <Loader2 className="h-3 w-3 animate-spin" />}
                  Pause {d} days
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Time + timezone */}
      <section className="rounded-xl border border-border bg-surface p-5 space-y-3">
        <p className="text-sm font-semibold text-text-primary">Send time</p>
        <div className="flex items-center gap-3">
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <span className="text-xs text-text-tertiary">Local time ({timezone})</span>
        </div>
        <p className="text-[11px] text-text-tertiary">
          Default 19:00. The cron checks every 30 minutes — actual send may be up to half an hour later.
        </p>
      </section>

      {/* Channels */}
      <section className="rounded-xl border border-border bg-surface p-5 space-y-3">
        <p className="text-sm font-semibold text-text-primary">Channels</p>
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2 text-text-secondary">
            <input
              type="checkbox"
              checked={!!channels.sms}
              onChange={(e) => setChannel('sms', e.target.checked)}
              className="h-4 w-4"
            />
            SMS
          </label>
          <label className="flex items-center gap-2 text-text-secondary">
            <input
              type="checkbox"
              checked={!!channels.email}
              onChange={(e) => setChannel('email', e.target.checked)}
              className="h-4 w-4"
            />
            Email
          </label>
          <label className="flex items-center gap-2 text-text-secondary">
            <input
              type="checkbox"
              checked={!!channels.push}
              onChange={(e) => setChannel('push', e.target.checked)}
              className="h-4 w-4"
            />
            Web push (owners + managers with an active device)
          </label>
        </div>
      </section>

      {/* Primary owner */}
      <section className="rounded-xl border border-border bg-surface p-5 space-y-2">
        <p className="text-sm font-semibold text-text-primary">Primary owner</p>
        <p className="text-xs text-text-secondary">
          Reads from your tenant contact details.
        </p>
        <div className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs text-text-secondary">
          {primary.phone ?? <em>no phone</em>} · {primary.email ?? <em>no email</em>}
        </div>
      </section>

      {/* Extra recipients */}
      <section className="rounded-xl border border-border bg-surface p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-text-primary">Additional recipients</p>
            <p className="mt-0.5 text-xs text-text-secondary">
              CFO, accountants, partners. SMS goes to anyone with a phone; email to anyone with an email.
            </p>
          </div>
          <button
            type="button"
            onClick={addRecipient}
            className="flex items-center gap-1 rounded-md border border-border bg-surface-raised px-2 py-1 text-[11px] font-medium hover:bg-surface-sunken transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        </div>

        {recipients.length === 0 && (
          <p className="rounded-lg border border-dashed border-border py-4 text-center text-xs text-text-tertiary">
            None yet. The primary owner still receives the digest.
          </p>
        )}

        {recipients.map((r, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <input
              value={r.name ?? ''}
              onChange={(e) => updateRecipient(i, { name: e.target.value })}
              placeholder="Name"
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
            />
            <input
              value={r.phone ?? ''}
              onChange={(e) => updateRecipient(i, { phone: e.target.value })}
              placeholder="Phone (optional)"
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
            />
            <input
              type="email"
              value={r.email ?? ''}
              onChange={(e) => updateRecipient(i, { email: e.target.value })}
              placeholder="Email (optional)"
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
            />
            <button
              type="button"
              onClick={() => removeRecipient(i)}
              className="rounded-md p-2 text-text-tertiary hover:bg-danger/10 hover:text-danger transition-colors"
              aria-label="Remove recipient"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </section>

      {error && (
        <div className="rounded-md bg-danger-subtle px-3 py-2 text-xs text-danger">{error}</div>
      )}
      {testResult && (
        <div className="rounded-md bg-success-subtle px-3 py-2 text-xs text-success">{testResult}</div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <p className="text-[11px] text-text-tertiary">
          {savedAt ? `Saved ${new Date(savedAt).toLocaleTimeString()}` : 'Unsaved changes'}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={sendTest}
            disabled={testing}
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface-raised px-3 py-2 text-xs font-medium hover:bg-surface-sunken transition-colors disabled:opacity-60"
          >
            {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send test now
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
