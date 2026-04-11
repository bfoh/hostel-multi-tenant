'use client'

import { useState } from 'react'
import { MessageSquare, Mail, ChevronDown, ChevronUp, Loader2, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'

interface Template {
  id: string
  event_type: string
  channel: 'sms' | 'email'
  subject?: string | null
  body: string
  is_active: boolean
}

const EVENT_TYPES = [
  { value: 'booking_confirmed',    label: 'Booking confirmed' },
  { value: 'booking_cancelled',    label: 'Booking cancelled' },
  { value: 'payment_received',     label: 'Payment received' },
  { value: 'payment_reminder',     label: 'Payment reminder' },
  { value: 'checkin_reminder',     label: 'Check-in reminder' },
  { value: 'checkout_reminder',    label: 'Check-out / lease expiry reminder' },
  { value: 'lease_expiry_reminder',label: 'Lease expiry (30-day)' },
  { value: 'deposit_refund',       label: 'Deposit refund notification' },
]

const VARS: Record<string, string[]> = {
  booking_confirmed:     ['{{first_name}}', '{{booking_ref}}', '{{check_in_date}}', '{{room_number}}', '{{amount}}'],
  booking_cancelled:     ['{{first_name}}', '{{booking_ref}}'],
  payment_received:      ['{{first_name}}', '{{amount}}', '{{balance}}', '{{booking_ref}}'],
  payment_reminder:      ['{{first_name}}', '{{amount}}', '{{due_date}}', '{{booking_ref}}'],
  checkin_reminder:      ['{{first_name}}', '{{check_in_date}}', '{{room_number}}'],
  checkout_reminder:     ['{{first_name}}', '{{check_out_date}}', '{{booking_ref}}'],
  lease_expiry_reminder: ['{{first_name}}', '{{check_out_date}}', '{{days_remaining}}', '{{booking_ref}}'],
  deposit_refund:        ['{{first_name}}', '{{refund_amount}}', '{{booking_ref}}'],
}

const DEFAULT_BODIES: Record<string, Record<string, string>> = {
  booking_confirmed: {
    sms:   'Hi {{first_name}}, your booking (Ref: {{booking_ref}}) is confirmed. Check-in: {{check_in_date}}, Room {{room_number}}. Amount: {{amount}}.',
    email: 'Dear {{first_name}},\n\nYour booking {{booking_ref}} has been confirmed.\n\nCheck-in: {{check_in_date}}\nRoom: {{room_number}}\nTotal: {{amount}}\n\nWelcome!',
  },
  payment_received: {
    sms:   'Hi {{first_name}}, we received your payment of {{amount}} for booking {{booking_ref}}. Balance: {{balance}}.',
    email: 'Dear {{first_name}},\n\nWe received your payment of {{amount}} for booking {{booking_ref}}.\nOutstanding balance: {{balance}}.\n\nThank you.',
  },
  checkout_reminder: {
    sms:   'Hi {{first_name}}, your stay ends on {{check_out_date}} (Ref: {{booking_ref}}). Contact us to renew or arrange checkout.',
    email: 'Dear {{first_name}},\n\nThis is a reminder that your stay ends on {{check_out_date}} (Ref: {{booking_ref}}).\n\nPlease contact us if you wish to renew your booking.',
  },
  lease_expiry_reminder: {
    sms:   'Hi {{first_name}}, your lease expires in {{days_remaining}} days ({{check_out_date}}). Ref: {{booking_ref}}.',
    email: '',
  },
  deposit_refund: {
    sms:   'Hi {{first_name}}, your deposit refund of {{refund_amount}} for booking {{booking_ref}} has been processed.',
    email: '',
  },
}

export function NotificationTemplatesClient({ initialTemplates }: { initialTemplates: Template[] }) {
  const [templates, setTemplates] = useState(initialTemplates)
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [saving, setSaving]       = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)

  // New template form
  const [showNew, setShowNew]       = useState(false)
  const [newEvent, setNewEvent]     = useState(EVENT_TYPES[0].value)
  const [newChannel, setNewChannel] = useState<'sms' | 'email'>('sms')
  const [newSubject, setNewSubject] = useState('')
  const [newBody, setNewBody]       = useState('')
  const [creating, setCreating]     = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Edit state per template
  const [editBody, setEditBody]       = useState<Record<string, string>>({})
  const [editSubject, setEditSubject] = useState<Record<string, string>>({})

  function openEdit(t: Template) {
    setExpanded(t.id)
    setEditBody((prev) => ({ ...prev, [t.id]: t.body }))
    setEditSubject((prev) => ({ ...prev, [t.id]: t.subject ?? '' }))
  }

  async function save(t: Template) {
    setSaving(t.id); setError(null)
    try {
      const res = await fetch(`/api/notification-templates/${t.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body:    editBody[t.id] ?? t.body,
          subject: editSubject[t.id] || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setTemplates((prev) => prev.map((x) => x.id === t.id ? data : x))
      setExpanded(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(null)
    }
  }

  async function toggle(t: Template) {
    setSaving(t.id)
    try {
      const res = await fetch(`/api/notification-templates/${t.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !t.is_active }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setTemplates((prev) => prev.map((x) => x.id === t.id ? data : x))
    } finally {
      setSaving(null)
    }
  }

  async function remove(id: string) {
    setSaving(id)
    try {
      await fetch(`/api/notification-templates/${id}`, { method: 'DELETE' })
      setTemplates((prev) => prev.filter((x) => x.id !== id))
      if (expanded === id) setExpanded(null)
    } finally {
      setSaving(null)
    }
  }

  async function create() {
    if (!newBody.trim()) { setCreateError('Body is required'); return }
    setCreating(true); setCreateError(null)
    try {
      const res = await fetch('/api/notification-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: newEvent,
          channel:    newChannel,
          subject:    newSubject || undefined,
          body:       newBody,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setTemplates((prev) => {
        const idx = prev.findIndex((t) => t.id === data.id)
        return idx >= 0 ? prev.map((t) => t.id === data.id ? data : t) : [data, ...prev]
      })
      setShowNew(false)
      setNewBody(''); setNewSubject(''); setNewEvent(EVENT_TYPES[0].value); setNewChannel('sms')
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setCreating(false)
    }
  }

  // Group by event type
  const grouped = EVENT_TYPES.map((et) => ({
    ...et,
    items: templates.filter((t) => t.event_type === et.value),
  }))

  return (
    <div className="space-y-4">
      {/* New template button */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            setShowNew((p) => !p)
            const def = DEFAULT_BODIES[newEvent]?.[newChannel] ?? ''
            setNewBody(def)
          }}
          className="flex items-center gap-1.5 rounded-lg border border-brand bg-brand px-3 py-2 text-sm font-medium text-brand-fg hover:bg-brand-hover transition-colors"
        >
          <Plus className="h-4 w-4" />
          New template
        </button>
      </div>

      {/* Create form */}
      {showNew && (
        <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
          <p className="font-semibold text-text-primary text-sm">New notification template</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-text-tertiary">Event</label>
              <select
                value={newEvent}
                onChange={(e) => {
                  setNewEvent(e.target.value)
                  setNewBody(DEFAULT_BODIES[e.target.value]?.[newChannel] ?? '')
                }}
                className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              >
                {EVENT_TYPES.map((et) => <option key={et.value} value={et.value}>{et.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-tertiary">Channel</label>
              <select
                value={newChannel}
                onChange={(e) => {
                  const ch = e.target.value as 'sms' | 'email'
                  setNewChannel(ch)
                  setNewBody(DEFAULT_BODIES[newEvent]?.[ch] ?? '')
                }}
                className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              >
                <option value="sms">SMS</option>
                <option value="email">Email</option>
              </select>
            </div>
          </div>
          {newChannel === 'email' && (
            <div>
              <label className="mb-1 block text-xs text-text-tertiary">Subject</label>
              <input
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="Email subject line"
                className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs text-text-tertiary">Body</label>
            <textarea
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              rows={5}
              className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-brand resize-y"
              placeholder="Message body... use {{variable}} placeholders"
            />
            <p className="mt-1 text-xs text-text-tertiary">
              Available variables: {(VARS[newEvent] ?? []).join(', ')}
            </p>
          </div>
          {createError && <p className="text-xs text-danger">{createError}</p>}
          <div className="flex gap-2">
            <button
              onClick={create}
              disabled={creating}
              className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-60"
            >
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Save template
            </button>
            <button
              onClick={() => setShowNew(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:bg-surface-raised transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      {/* Grouped list */}
      <div className="space-y-6">
        {grouped.map((group) => (
          <div key={group.value}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">{group.label}</h3>
            {group.items.length === 0 ? (
              <p className="text-sm text-text-disabled italic">No template — system default will be used</p>
            ) : (
              <div className="space-y-2">
                {group.items.map((t) => {
                  const isOpen = expanded === t.id
                  return (
                    <div key={t.id} className={`rounded-xl border bg-surface overflow-hidden ${!t.is_active ? 'opacity-60' : ''}`}>
                      <button
                        onClick={() => isOpen ? setExpanded(null) : openEdit(t)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-raised transition-colors"
                      >
                        {t.channel === 'sms'
                          ? <MessageSquare className="h-4 w-4 shrink-0 text-text-tertiary" />
                          : <Mail className="h-4 w-4 shrink-0 text-text-tertiary" />}
                        <span className="text-xs font-semibold uppercase text-text-secondary w-10">{t.channel}</span>
                        <p className="flex-1 truncate text-sm text-text-primary font-mono">{t.body.substring(0, 80)}{t.body.length > 80 ? '…' : ''}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggle(t) }}
                            disabled={saving === t.id}
                            title={t.is_active ? 'Disable' : 'Enable'}
                            className="text-text-tertiary hover:text-brand transition-colors"
                          >
                            {t.is_active ? <ToggleRight className="h-5 w-5 text-brand" /> : <ToggleLeft className="h-5 w-5" />}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); remove(t.id) }}
                            disabled={saving === t.id}
                            className="rounded p-1 text-text-tertiary hover:text-danger transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          {isOpen ? <ChevronUp className="h-4 w-4 text-text-tertiary" /> : <ChevronDown className="h-4 w-4 text-text-tertiary" />}
                        </div>
                      </button>

                      {isOpen && (
                        <div className="border-t border-border bg-surface-raised px-4 py-4 space-y-3">
                          {t.channel === 'email' && (
                            <div>
                              <label className="mb-1 block text-xs text-text-tertiary">Subject</label>
                              <input
                                value={editSubject[t.id] ?? ''}
                                onChange={(e) => setEditSubject((prev) => ({ ...prev, [t.id]: e.target.value }))}
                                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                              />
                            </div>
                          )}
                          <div>
                            <label className="mb-1 block text-xs text-text-tertiary">Body</label>
                            <textarea
                              value={editBody[t.id] ?? ''}
                              onChange={(e) => setEditBody((prev) => ({ ...prev, [t.id]: e.target.value }))}
                              rows={6}
                              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-brand resize-y"
                            />
                            <p className="mt-1 text-xs text-text-tertiary">
                              Variables: {(VARS[t.event_type] ?? []).join(', ')}
                            </p>
                          </div>
                          {error && <p className="text-xs text-danger">{error}</p>}
                          <div className="flex gap-2">
                            <button
                              onClick={() => save(t)}
                              disabled={saving === t.id}
                              className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-60"
                            >
                              {saving === t.id && <Loader2 className="h-4 w-4 animate-spin" />}
                              Save
                            </button>
                            <button
                              onClick={() => setExpanded(null)}
                              className="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:bg-surface transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
