'use client'

import { useState } from 'react'
import { Plus, Loader2, Send, Trash2, MessageSquare, Mail, Users, CheckCircle2, XCircle, QrCode, Download, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CAMPAIGN_AUDIENCE_LABEL, type CampaignAudience, type CampaignChannel } from '@/lib/marketing/audience'

interface Campaign {
  id: string
  name: string
  channel: CampaignChannel
  subject: string | null
  body: string
  audience: CampaignAudience
  status: 'draft' | 'sent' | 'failed'
  recipient_count: number
  sent_at: string | null
  created_at: string
}

const STATUS_STYLES: Record<string, string> = {
  draft:  'bg-surface-sunken text-text-secondary',
  sent:   'bg-success-subtle text-success',
  failed: 'bg-danger-subtle text-danger',
}

export function MarketingCampaignsClient({ initialCampaigns }: { initialCampaigns: Campaign[] }) {
  const [campaigns, setCampaigns] = useState(initialCampaigns)
  const [showForm, setShowForm]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [search, setSearch]       = useState('')

  const [name, setName]         = useState('')
  const [channel, setChannel]   = useState<CampaignChannel>('sms')
  const [subject, setSubject]   = useState('')
  const [body, setBody]         = useState('')
  const [audience, setAudience] = useState<CampaignAudience>('all_occupants')
  const searchTerms = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const visibleCampaigns = campaigns.filter((campaign) => {
    const haystack = [
      campaign.name,
      campaign.subject,
      campaign.body,
      campaign.channel,
      campaign.status,
      CAMPAIGN_AUDIENCE_LABEL[campaign.audience],
    ].filter(Boolean).join(' ').toLowerCase()
    return searchTerms.every(term => haystack.includes(term))
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/marketing/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, channel, subject: channel === 'email' ? subject : undefined, body, audience }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to create campaign')
      setCampaigns((prev) => [data, ...prev])
      setShowForm(false)
      setName(''); setChannel('sms'); setSubject(''); setBody(''); setAudience('all_occupants')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  async function send(campaign: Campaign) {
    if (!confirm(`Send "${campaign.name}" to ${campaign.recipient_count} recipient${campaign.recipient_count === 1 ? '' : 's'} now? This can't be undone.`)) return
    setSendingId(campaign.id); setError(null)
    try {
      const res = await fetch(`/api/marketing/campaigns/${campaign.id}/send`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Send failed')
      setCampaigns((prev) => prev.map((c) => (c.id === campaign.id ? data : c)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed')
    } finally {
      setSendingId(null)
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this draft?')) return
    setDeletingId(id)
    await fetch(`/api/marketing/campaigns/${id}`, { method: 'DELETE' })
    setCampaigns((prev) => prev.filter((c) => c.id !== id))
    setDeletingId(null)
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* QR code card */}
      <Card>
        <CardHeader><CardTitle>Property QR code</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-4">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-border bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/api/marketing/qr?size=256" alt="QR code linking to your public listing page" className="h-full w-full" />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-text-secondary">
                Scan to open your public listing page — print it, put it on a flyer, or share it directly.
              </p>
              <div className="flex gap-2">
                <a
                  href="/api/marketing/qr?format=png&size=1024"
                  download="property-qr.png"
                  className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-surface-raised"
                >
                  <Download className="h-3.5 w-3.5" /> Download PNG
                </a>
                <a
                  href="/api/marketing/qr?format=svg"
                  download="property-qr.svg"
                  className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-surface-raised"
                >
                  <QrCode className="h-3.5 w-3.5" /> Download SVG
                </a>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaigns */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Campaigns</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-fg transition-colors hover:bg-brand-hover"
        >
          <Plus className="h-4 w-4" /> New campaign
        </button>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <label className="relative block">
        <span className="sr-only">Search campaigns</span>
        <Search className="text-text-tertiary pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search campaign, message, channel, audience, or status"
          className="border-border bg-surface text-text-primary placeholder:text-text-disabled focus:border-brand w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm outline-none"
        />
      </label>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>New campaign</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-text-tertiary">Name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={150}
                    placeholder="e.g. Weekend promo"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-tertiary">Channel</label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as CampaignChannel)}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                  >
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-text-tertiary">Audience</label>
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as CampaignAudience)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  {Object.entries(CAMPAIGN_AUDIENCE_LABEL).map(([v, label]) => (
                    <option key={v} value={v}>{label}</option>
                  ))}
                </select>
              </div>

              {channel === 'email' && (
                <div>
                  <label className="mb-1 block text-xs text-text-tertiary">Subject</label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    maxLength={200}
                    placeholder="Email subject"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs text-text-tertiary">Message</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  required
                  rows={5}
                  maxLength={4000}
                  placeholder={channel === 'sms' ? 'Keep it short — SMS is billed per segment.' : 'Write your email…'}
                  className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg transition-colors hover:bg-brand-hover disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save as draft
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-raised"
                >
                  Cancel
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {visibleCampaigns.length === 0 && !showForm ? (
        <p className="py-12 text-center text-sm text-text-tertiary">
          {searchTerms.length > 0 ? 'No campaigns match your search.' : 'No campaigns yet'}
        </p>
      ) : (
        <div className="space-y-2">
          {visibleCampaigns.map((c) => (
            <div key={c.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-text-primary">{c.name}</p>
                    <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[c.status]}`}>
                      {c.status === 'sent' && <CheckCircle2 className="h-3 w-3" />}
                      {c.status === 'failed' && <XCircle className="h-3 w-3" />}
                      {c.status}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-text-tertiary">
                      {c.channel === 'sms' ? <MessageSquare className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
                      {c.channel.toUpperCase()}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-text-tertiary">
                      <Users className="h-3 w-3" /> {c.recipient_count} recipient{c.recipient_count === 1 ? '' : 's'}
                    </span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm text-text-secondary">{c.body}</p>
                  <p className="mt-1 text-xs text-text-disabled">
                    {c.sent_at
                      ? `Sent ${new Date(c.sent_at).toLocaleDateString('en-GH', { dateStyle: 'medium' })}`
                      : `Draft · ${CAMPAIGN_AUDIENCE_LABEL[c.audience]}`}
                  </p>
                </div>
                {c.status === 'draft' && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => send(c)}
                      disabled={sendingId === c.id}
                      className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-brand-fg transition-colors hover:bg-brand-hover disabled:opacity-60"
                    >
                      {sendingId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Send
                    </button>
                    <button
                      onClick={() => remove(c.id)}
                      disabled={deletingId === c.id}
                      className="rounded-md p-1.5 text-text-disabled transition-colors hover:text-danger"
                    >
                      {deletingId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
