'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Loader2, Megaphone, Users } from 'lucide-react'

interface Props {
  blocks:         string[]
  totalOccupants: number
}

export function BroadcastComposer({ blocks, totalOccupants }: Props) {
  const router = useRouter()
  const [scope, setScope]   = useState<'all' | string>('all')   // 'all' | block label
  const [title, setTitle]   = useState('')
  const [body, setBody]     = useState('')
  const [busy, setBusy]     = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [done, setDone]     = useState<{ conversation_id: string } | null>(null)

  async function send() {
    const text = body.trim()
    if (!text || busy) return
    setBusy(true); setError(null)
    try {
      const filter =
        scope === 'all'
          ? undefined
          : { block: scope, title: title.trim() || undefined }
      const res = await fetch('/api/messages/broadcasts', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ body: text, filter }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Broadcast failed')
        return
      }
      setDone({ conversation_id: data.conversation_id })
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-success/30 bg-success-subtle p-5 space-y-3">
        <div className="flex items-center gap-2 text-success">
          <Megaphone className="h-4 w-4" />
          <p className="text-sm font-semibold">Announcement sent</p>
        </div>
        <p className="text-xs text-text-secondary">
          Occupants in scope will see it in their Announcements channel.
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/messages/${done.conversation_id}`}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:bg-surface-raised transition-colors"
          >
            View thread
          </a>
          <button
            onClick={() => { setDone(null); setBody(''); setTitle('') }}
            className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
          >
            Send another
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Scope */}
      <section className="rounded-2xl border border-border bg-surface p-4 space-y-3">
        <p className="text-sm font-semibold text-text-primary">Audience</p>
        <div className="flex flex-wrap gap-2">
          <Chip
            active={scope === 'all'}
            onClick={() => setScope('all')}
          >
            <Users className="h-3 w-3" />
            All occupants ({totalOccupants})
          </Chip>
          {blocks.map((b) => (
            <Chip key={b} active={scope === b} onClick={() => setScope(b)}>
              Block {b}
            </Chip>
          ))}
        </div>
        {scope !== 'all' && (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Channel title (optional, defaults to 'Block X announcements')"
            maxLength={120}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
          />
        )}
      </section>

      {/* Body */}
      <section className="rounded-2xl border border-border bg-surface p-4 space-y-2">
        <p className="text-sm font-semibold text-text-primary">Message</p>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          maxLength={4000}
          placeholder={"e.g. Water service will be interrupted Tuesday 9 am – 1 pm. Please prepare in advance."}
          className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
        />
        <p className="text-[11px] text-text-tertiary text-right">{body.length} / 4000</p>
      </section>

      {error && (
        <div className="rounded-md bg-danger-subtle px-3 py-2 text-xs text-danger">{error}</div>
      )}

      <div className="flex items-center justify-end gap-2">
        <a
          href="/messages"
          className="rounded-md border border-border px-3 py-2 text-xs font-medium text-text-secondary hover:bg-surface-raised transition-colors"
        >
          Cancel
        </a>
        <button
          onClick={send}
          disabled={busy || !body.trim()}
          className="flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send announcement
        </button>
      </div>
    </div>
  )
}

function Chip({ children, active, onClick }: {
  children: React.ReactNode
  active:   boolean
  onClick:  () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'border-transparent bg-brand text-brand-fg'
          : 'border-border bg-surface text-text-secondary hover:bg-surface-raised'
      }`}
    >
      {children}
    </button>
  )
}
