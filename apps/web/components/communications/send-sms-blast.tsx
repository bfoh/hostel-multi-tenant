'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send, X } from 'lucide-react'

const RECIPIENT_OPTIONS = [
  { value: 'all_occupants',    label: 'All occupants' },
  { value: 'active_occupants', label: 'Active occupants (currently checked in)' },
  { value: 'overdue_rent',     label: 'Occupants with overdue rent' },
  { value: 'specific_rooms',   label: 'Specific rooms (comma-separated)' },
  { value: 'manual_list',      label: 'Manual phone numbers (comma-separated)' },
]

const TEMPLATES = [
  { label: 'Rent reminder', text: 'Dear resident, this is a reminder that your rent payment is due. Please settle your balance to avoid disruption. Thank you.' },
  { label: 'Facility notice', text: 'Dear resident, please be informed of scheduled maintenance this week. We apologize for any inconvenience.' },
  { label: 'General announcement', text: 'Dear resident, we have an important announcement for all hostel residents. Please check the notice board for details.' },
]

export function SendSMSBlast({ disabled }: { disabled: boolean }) {
  const router = useRouter()
  const [open, setOpen]     = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [result, setResult] = useState<{ recipient_count: number } | null>(null)

  const [form, setForm] = useState({
    message:        '',
    recipient_type: 'active_occupants',
    room_numbers:   '',
    phone_numbers:  '',
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const charCount = form.message.length
  const smsCount  = Math.ceil(charCount / 160) || 1

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setResult(null)
    try {
      const payload: Record<string, unknown> = {
        message:        form.message,
        recipient_type: form.recipient_type,
      }
      if (form.recipient_type === 'specific_rooms' && form.room_numbers) {
        payload.room_numbers = form.room_numbers.split(',').map(s => s.trim()).filter(Boolean)
      }
      if (form.recipient_type === 'manual_list' && form.phone_numbers) {
        payload.phone_numbers = form.phone_numbers.split(',').map(s => s.trim()).filter(Boolean)
      }

      const res = await fetch('/api/communications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error))
      setResult(data)
      setForm({ message: '', recipient_type: 'active_occupants', room_numbers: '', phone_numbers: '' })
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setError(null); setResult(null) }}
        className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
      >
        <Send className="h-4 w-4" /> Send SMS
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-text-primary">Send bulk SMS</h2>
              <button onClick={() => setOpen(false)} className="text-text-disabled hover:text-text-primary transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {result ? (
              <div className="space-y-4 text-center py-4">
                <div className="flex items-center justify-center">
                  <div className="rounded-full bg-success-subtle p-4">
                    <Send className="h-8 w-8 text-success" />
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-text-primary">Message queued!</p>
                  <p className="text-sm text-text-secondary mt-1">
                    Your message is being sent to {result.recipient_count} recipient{result.recipient_count !== 1 ? 's' : ''}.
                  </p>
                </div>
                <button onClick={() => setOpen(false)}
                  className="rounded-md bg-brand px-6 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors">
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Recipients *</label>
                  <select value={form.recipient_type} onChange={e => set('recipient_type', e.target.value)} className={inputCls}>
                    {RECIPIENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                {form.recipient_type === 'specific_rooms' && (
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Room numbers (comma-separated)</label>
                    <input value={form.room_numbers} onChange={e => set('room_numbers', e.target.value)}
                      className={inputCls} placeholder="12A, 12B, 15" />
                  </div>
                )}

                {form.recipient_type === 'manual_list' && (
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Phone numbers (comma-separated)</label>
                    <input value={form.phone_numbers} onChange={e => set('phone_numbers', e.target.value)}
                      className={inputCls} placeholder="0244000000, 0550000000" />
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-text-secondary">Message *</label>
                    <span className={`text-[10px] ${charCount > 160 ? 'text-warning-fg' : 'text-text-tertiary'}`}>
                      {charCount}/160 ({smsCount} SMS)
                    </span>
                  </div>
                  <textarea value={form.message} onChange={e => set('message', e.target.value)} required
                    className={inputCls} rows={4} maxLength={480}
                    placeholder="Type your message here…" />
                </div>

                <div>
                  <p className="text-xs text-text-tertiary mb-2">Quick templates:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {TEMPLATES.map(t => (
                      <button key={t.label} type="button"
                        onClick={() => set('message', t.text)}
                        className="rounded border border-border px-2 py-1 text-[11px] text-text-secondary hover:bg-surface-raised hover:text-text-primary transition-colors">
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {disabled && (
                  <p className="text-xs text-warning-fg bg-warning-subtle border border-warning/20 rounded px-3 py-2">
                    ARKESEL_API_KEY not configured. Message will be saved but not delivered.
                  </p>
                )}

                {error && <p className="text-sm text-danger">{error}</p>}

                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setOpen(false)} className={cancelCls}>Cancel</button>
                  <button type="submit" disabled={saving}
                    className="flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover disabled:opacity-50 transition-colors">
                    <Send className="h-3.5 w-3.5" />
                    {saving ? 'Sending…' : 'Send message'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}

const inputCls  = 'w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand transition-colors'
const cancelCls = 'rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-raised transition-colors'
