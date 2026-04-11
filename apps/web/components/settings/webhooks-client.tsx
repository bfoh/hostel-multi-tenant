'use client'

import { useState } from 'react'
import { Plus, Loader2, Trash2, ToggleLeft, ToggleRight, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Endpoint {
  id: string; url: string; events: string[]; description: string | null
  is_active: boolean; created_at: string
}
interface WebhookEvent {
  id: string; endpoint_id: string; event_type: string
  status: string; response_status: number | null; created_at: string
}

const AVAILABLE_EVENTS = [
  { value: '*',                      label: 'All events (wildcard)' },
  { value: 'booking.created',        label: 'Booking created' },
  { value: 'booking.confirmed',      label: 'Booking confirmed' },
  { value: 'booking.checked_in',     label: 'Guest checked in' },
  { value: 'booking.checked_out',    label: 'Guest checked out' },
  { value: 'booking.cancelled',      label: 'Booking cancelled' },
  { value: 'payment.received',       label: 'Payment received' },
  { value: 'maintenance.created',    label: 'Maintenance request created' },
  { value: 'maintenance.resolved',   label: 'Maintenance request resolved' },
  { value: 'occupant.created',       label: 'Occupant created' },
]

const STATUS_ICON: Record<string, React.ReactNode> = {
  delivered: <CheckCircle2 className="h-3.5 w-3.5 text-success" />,
  failed:    <XCircle className="h-3.5 w-3.5 text-danger" />,
  pending:   <Clock className="h-3.5 w-3.5 text-text-tertiary" />,
}

export function WebhooksClient({
  initialEndpoints, initialEvents,
}: { initialEndpoints: Endpoint[]; initialEvents: WebhookEvent[] }) {
  const [endpoints, setEndpoints] = useState(initialEndpoints)
  const [events]                  = useState(initialEvents)
  const [showForm, setShowForm]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)

  const [url, setUrl]             = useState('')
  const [desc, setDesc]           = useState('')
  const [selEvents, setSelEvents] = useState<string[]>(['booking.created'])

  function toggleEvent(ev: string) {
    setSelEvents((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!selEvents.length) { setError('Select at least one event'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, description: desc || undefined, events: selEvents }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setEndpoints((prev) => [data, ...prev])
      setShowForm(false); setUrl(''); setDesc(''); setSelEvents(['booking.created'])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(ep: Endpoint) {
    const res = await fetch(`/api/webhooks/${ep.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !ep.is_active }),
    })
    if (res.ok) setEndpoints((prev) => prev.map((e) => e.id === ep.id ? { ...e, is_active: !e.is_active } : e))
  }

  async function remove(id: string) {
    if (!confirm('Delete this webhook endpoint?')) return
    setDeletingId(id)
    await fetch(`/api/webhooks/${id}`, { method: 'DELETE' })
    setEndpoints((prev) => prev.filter((e) => e.id !== id))
    setDeletingId(null)
  }

  const endpointEvents = (epId: string) => events.filter((ev) => ev.endpoint_id === epId).slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-fg hover:bg-brand-hover transition-colors">
          <Plus className="h-4 w-4" />
          Add endpoint
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader><CardTitle>New webhook endpoint</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs text-text-tertiary">Endpoint URL</label>
                <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} required
                  placeholder="https://example.com/webhook"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-brand" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-tertiary">Description (optional)</label>
                <input value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={200}
                  placeholder="e.g. Zapier integration"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand" />
              </div>
              <div>
                <label className="mb-2 block text-xs text-text-tertiary">Events to subscribe to</label>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_EVENTS.map((ev) => (
                    <label key={ev.value} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={selEvents.includes(ev.value)}
                        onChange={() => toggleEvent(ev.value)}
                        className="h-4 w-4 rounded border-border accent-brand" />
                      <span className="text-text-secondary">{ev.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              {error && <p className="text-xs text-danger">{error}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={saving}
                  className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-60">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save endpoint
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-raised transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Endpoints */}
      {endpoints.length === 0 && !showForm && (
        <p className="py-10 text-center text-sm text-text-tertiary">No webhook endpoints configured</p>
      )}
      <div className="space-y-4">
        {endpoints.map((ep) => (
          <Card key={ep.id} className={!ep.is_active ? 'opacity-60' : ''}>
            <CardContent className="py-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-medium text-text-primary truncate">{ep.url}</p>
                  {ep.description && <p className="text-xs text-text-tertiary mt-0.5">{ep.description}</p>}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {ep.events.map((ev) => (
                      <span key={ev} className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] text-text-secondary">{ev}</span>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button onClick={() => toggleActive(ep)} title={ep.is_active ? 'Disable' : 'Enable'}
                    className="text-text-tertiary hover:text-brand transition-colors">
                    {ep.is_active
                      ? <ToggleRight className="h-5 w-5 text-success" />
                      : <ToggleLeft className="h-5 w-5" />}
                  </button>
                  <button onClick={() => remove(ep.id)} disabled={deletingId === ep.id}
                    className="p-1 text-text-disabled hover:text-danger transition-colors">
                    {deletingId === ep.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Recent delivery log */}
              {endpointEvents(ep.id).length > 0 && (
                <div className="border-t border-border pt-2 space-y-1">
                  <p className="text-[11px] font-medium text-text-disabled uppercase tracking-wide">Recent deliveries</p>
                  {endpointEvents(ep.id).map((ev) => (
                    <div key={ev.id} className="flex items-center gap-2 text-xs text-text-secondary">
                      {STATUS_ICON[ev.status] ?? STATUS_ICON.pending}
                      <span className="font-mono">{ev.event_type}</span>
                      {ev.response_status && <span className="text-text-disabled">HTTP {ev.response_status}</span>}
                      <span className="ml-auto text-text-disabled">
                        {new Date(ev.created_at).toLocaleTimeString('en-GH', { timeStyle: 'short' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info box */}
      <Card>
        <CardContent className="py-4">
          <p className="text-xs font-medium text-text-tertiary mb-2">Signature verification</p>
          <p className="text-xs text-text-secondary">
            Every request is signed with <span className="font-mono bg-surface-sunken px-1 rounded">HMAC-SHA256</span> using your endpoint's secret.
            Verify the <span className="font-mono bg-surface-sunken px-1 rounded">X-GH Hostels-Sig</span> header to confirm authenticity.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
