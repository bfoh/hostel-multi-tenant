'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Search, X, Users, Megaphone, User } from 'lucide-react'

interface SearchResult {
  user_id:  string
  display:  string
  subtitle: string | null
  kind:     'staff' | 'occupant'
}

export function GroupCreator() {
  const router = useRouter()
  const [title, setTitle]     = useState('')
  const [q, setQ]             = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [picked, setPicked]   = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    const id = setTimeout(async () => {
      setLoading(true); setError(null)
      try {
        const params = new URLSearchParams()
        if (q.trim()) params.set('q', q.trim())
        const res = await fetch(`/api/messages/users/search?${params.toString()}`)
        const data = await res.json()
        if (!res.ok) {
          setError(typeof data.error === 'string' ? data.error : 'Search failed')
          return
        }
        const pickedIds = new Set(picked.map(p => p.user_id))
        setResults(((data.results ?? []) as SearchResult[]).filter(r => !pickedIds.has(r.user_id)))
      } finally {
        setLoading(false)
      }
    }, 200)
    return () => clearTimeout(id)
  }, [q, picked])

  function pick(r: SearchResult) {
    setPicked((cur) => (cur.some(x => x.user_id === r.user_id) ? cur : [...cur, r]))
    setQ('')
  }
  function unpick(uid: string) {
    setPicked((cur) => cur.filter(x => x.user_id !== uid))
  }

  async function create() {
    if (busy) return
    if (!title.trim())     { setError('Group needs a name'); return }
    if (picked.length === 0) { setError('Pick at least one member'); return }
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/messages/conversations/group', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          title: title.trim(),
          member_ids: picked.map(p => p.user_id),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Group creation failed')
        return
      }
      router.push(`/messages/${data.id}`)
    } catch {
      setError('Network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-surface p-4 space-y-3">
        <p className="text-sm font-semibold text-text-primary">Group name</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Maintenance team · Block A residents · …"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-text-primary">Members</p>
          <p className="text-[11px] text-text-tertiary">{picked.length} selected</p>
        </div>

        {picked.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {picked.map((p) => (
              <span key={p.user_id} className="flex items-center gap-1 rounded-full border border-border bg-surface-raised px-2 py-1 text-[11px]">
                {p.kind === 'staff' ? <Megaphone className="h-3 w-3 text-blue-700" /> : <User className="h-3 w-3 text-emerald-700" />}
                {p.display}
                <button onClick={() => unpick(p.user_id)} className="text-text-tertiary hover:text-danger">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search staff or occupants…"
            className="w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>

        {loading && (
          <div className="flex items-center justify-center py-4 text-xs text-text-tertiary">
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Searching…
          </div>
        )}

        {!loading && results.length > 0 && (
          <ul className="max-h-60 overflow-y-auto divide-y divide-border rounded-lg border border-border">
            {results.map((r) => (
              <li key={r.user_id}>
                <button
                  onClick={() => pick(r)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-raised transition-colors"
                >
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    r.kind === 'staff' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {r.kind === 'staff' ? <Megaphone className="h-3 w-3" /> : <User className="h-3 w-3" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">{r.display}</p>
                    {r.subtitle && <p className="truncate text-[11px] text-text-tertiary">{r.subtitle}</p>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
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
          onClick={create}
          disabled={busy || !title.trim() || picked.length === 0}
          className="flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
          Create group
        </button>
      </div>
    </div>
  )
}
