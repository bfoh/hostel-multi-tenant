'use client'

import { useState } from 'react'
import { Plus, Loader2, Pin, Trash2, AlertTriangle, Wrench, DollarSign, Calendar, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useBulkSelect, BulkActionBar } from '@/components/ui/bulk-select'

interface Notice {
  id: string; title: string; body: string; category: string
  is_pinned: boolean; published_at: string; expires_at: string | null
}

const CAT_CONFIG: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  general:     { label: 'General',     icon: Info,          cls: 'bg-surface-sunken text-text-secondary' },
  urgent:      { label: 'Urgent',      icon: AlertTriangle, cls: 'bg-danger-subtle text-danger' },
  maintenance: { label: 'Maintenance', icon: Wrench,        cls: 'bg-warning-subtle text-warning-fg' },
  payment:     { label: 'Payment',     icon: DollarSign,    cls: 'bg-brand-subtle text-brand' },
  event:       { label: 'Event',       icon: Calendar,      cls: 'bg-success-subtle text-success' },
}

export function NoticesClient({ initialNotices }: { initialNotices: Notice[] }) {
  const [notices, setNotices] = useState(initialNotices)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle]       = useState('')
  const [body, setBody]         = useState('')
  const [category, setCategory] = useState('general')
  const [pinned, setPinned]     = useState(false)
  const [expiresAt, setExpiresAt] = useState('')

  const bulk = useBulkSelect(notices.map((n) => n.id))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, body, category, is_pinned: pinned,
          expires_at: expiresAt || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setNotices((prev) => [data, ...prev].sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0)))
      setShowForm(false)
      setTitle(''); setBody(''); setCategory('general'); setPinned(false); setExpiresAt('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  async function togglePin(notice: Notice) {
    const res = await fetch(`/api/notices/${notice.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_pinned: !notice.is_pinned }),
    })
    if (res.ok) {
      setNotices((prev) =>
        prev.map((n) => n.id === notice.id ? { ...n, is_pinned: !n.is_pinned } : n)
          .sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0))
      )
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this notice?')) return
    setDeletingId(id)
    await fetch(`/api/notices/${id}`, { method: 'DELETE' })
    setNotices((prev) => prev.filter((n) => n.id !== id))
    setDeletingId(null)
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-end gap-2">
        {notices.length > 0 && (
          <BulkActionBar bulk={bulk} resource="notices" itemNoun="notice" />
        )}
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-fg hover:bg-brand-hover transition-colors"
        >
          <Plus className="h-4 w-4" />
          New notice
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader><CardTitle>Post a notice</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs text-text-tertiary">Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                  placeholder="Notice title" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-tertiary">Message</label>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={4} maxLength={4000}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand resize-none"
                  placeholder="Notice body..." />
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs text-text-tertiary">Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand">
                    {Object.entries(CAT_CONFIG).map(([v, c]) => (
                      <option key={v} value={v}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-tertiary">Expires (optional)</label>
                  <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand" />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                    <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)}
                      className="h-4 w-4 rounded border-border" />
                    Pin to top
                  </label>
                </div>
              </div>
              {error && <p className="text-xs text-danger">{error}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={saving}
                  className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-60">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Post notice
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

      {/* Notices list */}
      {notices.length === 0 && !showForm && (
        <p className="py-12 text-center text-sm text-text-tertiary">No notices posted yet</p>
      )}
      <div className="space-y-3">
        {notices.map((n) => {
          const cfg = CAT_CONFIG[n.category] ?? CAT_CONFIG.general
          const Icon = cfg.icon
          const isExpired = n.expires_at && new Date(n.expires_at) < new Date()
          return (
            <Card key={n.id} className={isExpired ? 'opacity-50' : ''}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    {bulk.selectMode && (
                      <input
                        type="checkbox"
                        checked={bulk.isSelected(n.id)}
                        onChange={() => bulk.toggle(n.id)}
                        className="mt-1 h-4 w-4 rounded border-border text-brand focus:ring-brand"
                      />
                    )}
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cfg.cls}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-text-primary">{n.title}</p>
                        {n.is_pinned && (
                          <span className="flex items-center gap-1 rounded-full bg-brand-subtle px-2 py-0.5 text-[11px] font-medium text-brand">
                            <Pin className="h-3 w-3" /> Pinned
                          </span>
                        )}
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cfg.cls}`}>{cfg.label}</span>
                        {isExpired && <span className="text-[11px] text-danger">Expired</span>}
                      </div>
                      <p className="mt-1 text-sm text-text-secondary whitespace-pre-wrap">{n.body}</p>
                      <p className="mt-2 text-xs text-text-disabled">
                        {new Date(n.published_at).toLocaleDateString('en-GH', { dateStyle: 'medium' })}
                        {n.expires_at ? ` · Expires ${new Date(n.expires_at).toLocaleDateString('en-GH', { dateStyle: 'short' })}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => togglePin(n)} title={n.is_pinned ? 'Unpin' : 'Pin'}
                      className={`rounded-md p-1.5 transition-colors ${n.is_pinned ? 'text-brand' : 'text-text-disabled hover:text-brand'}`}>
                      <Pin className="h-4 w-4" />
                    </button>
                    <button onClick={() => remove(n.id)} disabled={deletingId === n.id}
                      className="rounded-md p-1.5 text-text-disabled hover:text-danger transition-colors">
                      {deletingId === n.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
