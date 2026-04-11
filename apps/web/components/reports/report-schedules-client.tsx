'use client'

import { useState } from 'react'
import { Clock, Plus, Trash2, Loader2, ToggleLeft, ToggleRight, Mail } from 'lucide-react'

interface Schedule {
  id: string
  name: string
  report_type: string
  frequency: string
  day_of_week?: number | null
  day_of_month?: number | null
  recipients: string[]
  is_active: boolean
  last_sent_at?: string | null
  next_run_at?: string | null
}

const REPORT_TYPES = [
  { value: 'bookings',    label: 'Bookings' },
  { value: 'occupants',   label: 'Occupants' },
  { value: 'payments',    label: 'Payments' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'expenses',    label: 'Expenses' },
]

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function freqLabel(s: Schedule) {
  if (s.frequency === 'daily') return 'Daily at 6:00 AM'
  if (s.frequency === 'weekly') return `Weekly on ${DAYS[s.day_of_week ?? 1]}s`
  if (s.frequency === 'monthly') return `Monthly on day ${s.day_of_month ?? 1}`
  return s.frequency
}

export function ReportSchedulesClient({ initialSchedules }: { initialSchedules: Schedule[] }) {
  const [schedules, setSchedules] = useState(initialSchedules)
  const [saving, setSaving]       = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [showNew, setShowNew]     = useState(false)

  // Form state
  const [name, setName]         = useState('')
  const [reportType, setReportType] = useState('bookings')
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [dayOfWeek, setDayOfWeek] = useState(1)
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const [recipientInput, setRecipientInput] = useState('')
  const [recipients, setRecipients] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  function addRecipient() {
    const email = recipientInput.trim()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setCreateError('Invalid email address'); return }
    if (recipients.includes(email)) return
    if (recipients.length >= 10) { setCreateError('Maximum 10 recipients'); return }
    setRecipients((prev) => [...prev, email])
    setRecipientInput('')
    setCreateError(null)
  }

  async function create() {
    if (!name.trim()) { setCreateError('Name is required'); return }
    if (recipients.length === 0) { setCreateError('At least one recipient required'); return }
    setCreating(true); setCreateError(null)
    try {
      const body: Record<string, unknown> = { name: name.trim(), report_type: reportType, frequency, recipients }
      if (frequency === 'weekly') body.day_of_week = dayOfWeek
      if (frequency === 'monthly') body.day_of_month = dayOfMonth
      const res = await fetch('/api/report-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setSchedules((prev) => [data, ...prev])
      setShowNew(false)
      setName(''); setRecipients([]); setRecipientInput(''); setFrequency('weekly')
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setCreating(false)
    }
  }

  async function toggle(s: Schedule) {
    setSaving(s.id)
    try {
      const res = await fetch(`/api/report-schedules/${s.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !s.is_active }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setSchedules((prev) => prev.map((x) => x.id === s.id ? data : x))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(null)
    }
  }

  async function remove(id: string) {
    setSaving(id)
    try {
      await fetch(`/api/report-schedules/${id}`, { method: 'DELETE' })
      setSchedules((prev) => prev.filter((x) => x.id !== id))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowNew((p) => !p)}
          className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-fg hover:bg-brand-hover transition-colors"
        >
          <Plus className="h-4 w-4" /> New schedule
        </button>
      </div>

      {/* Create form */}
      {showNew && (
        <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
          <p className="font-semibold text-text-primary text-sm">New report schedule</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="mb-1 block text-xs text-text-tertiary">Schedule name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Weekly Bookings Summary"
                className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-tertiary">Report type</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              >
                {REPORT_TYPES.map((rt) => <option key={rt.value} value={rt.value}>{rt.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-tertiary">Frequency</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as 'daily' | 'weekly' | 'monthly')}
                className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            {frequency === 'weekly' && (
              <div>
                <label className="mb-1 block text-xs text-text-tertiary">Day of week</label>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
            )}
            {frequency === 'monthly' && (
              <div>
                <label className="mb-1 block text-xs text-text-tertiary">Day of month</label>
                <input
                  type="number" min={1} max={28}
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
            )}
          </div>

          {/* Recipients */}
          <div>
            <label className="mb-1 block text-xs text-text-tertiary">Recipients</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRecipient() } }}
                placeholder="email@example.com"
                className="flex-1 rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              />
              <button
                onClick={addRecipient}
                className="rounded-lg border border-border px-3 py-2 text-sm text-text-secondary hover:bg-surface-raised transition-colors"
              >
                Add
              </button>
            </div>
            {recipients.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {recipients.map((r) => (
                  <span key={r} className="flex items-center gap-1 rounded-full bg-brand-subtle border border-brand/20 px-2.5 py-0.5 text-xs text-brand">
                    <Mail className="h-3 w-3" />{r}
                    <button onClick={() => setRecipients((prev) => prev.filter((x) => x !== r))} className="ml-1 hover:text-danger">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {createError && <p className="text-xs text-danger">{createError}</p>}
          <div className="flex gap-2">
            <button
              onClick={create}
              disabled={creating}
              className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-60"
            >
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Save schedule
            </button>
            <button onClick={() => setShowNew(false)} className="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:bg-surface-raised transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      {/* List */}
      {schedules.length === 0 ? (
        <p className="py-16 text-center text-sm text-text-tertiary">No report schedules configured yet</p>
      ) : (
        <div className="space-y-3">
          {schedules.map((s) => (
            <div key={s.id} className={`rounded-xl border border-border bg-surface p-4 ${!s.is_active ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 shrink-0 text-brand mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-text-primary text-sm">{s.name}</p>
                    <span className="rounded-full border border-border bg-surface-raised px-2 py-0.5 text-[11px] text-text-secondary capitalize">
                      {s.report_type}
                    </span>
                    {!s.is_active && (
                      <span className="rounded-full border border-border bg-surface-sunken px-2 py-0.5 text-[11px] text-text-tertiary">Paused</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-text-secondary">{freqLabel(s)}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {s.recipients.map((r) => (
                      <span key={r} className="text-xs text-text-tertiary font-mono">{r}</span>
                    ))}
                  </div>
                  <div className="mt-1 flex gap-4 text-xs text-text-disabled">
                    {s.last_sent_at && <span>Last sent: {new Date(s.last_sent_at).toLocaleDateString()}</span>}
                    {s.next_run_at && s.is_active && <span>Next: {new Date(s.next_run_at).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {saving === s.id && <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" />}
                  <button
                    onClick={() => toggle(s)}
                    disabled={saving === s.id}
                    title={s.is_active ? 'Pause' : 'Resume'}
                    className="text-text-tertiary hover:text-brand transition-colors"
                  >
                    {s.is_active ? <ToggleRight className="h-5 w-5 text-brand" /> : <ToggleLeft className="h-5 w-5" />}
                  </button>
                  <button
                    onClick={() => remove(s.id)}
                    disabled={saving === s.id}
                    className="rounded p-1 text-text-tertiary hover:text-danger transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-info/20 bg-info-subtle px-4 py-3 text-xs text-info">
        <strong>Note:</strong> Scheduled delivery requires a cron job or serverless trigger to call{' '}
        <code className="font-mono bg-white/40 px-1 rounded">/api/report-schedules/run</code> daily.
        Reports are exported as CSV and emailed via your configured email provider.
      </div>
    </div>
  )
}
