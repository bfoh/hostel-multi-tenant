'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Loader2, Search, Megaphone, User } from 'lucide-react'

interface SearchResult {
  user_id:  string
  display:  string
  subtitle: string | null
  kind:     'staff' | 'occupant'
}

interface Props {
  basePath: string                      // '/messages' or '/occupant-portal/messages'
  staffOnly?: boolean                   // occupant portal default
  label?:    string
}

export function NewMessageButton({ basePath, staffOnly = false, label = 'New message' }: Props) {
  const router = useRouter()
  const [open, setOpen]     = useState(false)
  const [q, setQ]           = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState<string | null>(null)
  const [error, setError]   = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setTimeout(() => inputRef.current?.focus(), 30)
  }, [open])

  // Debounced search
  useEffect(() => {
    if (!open) return
    const id = setTimeout(async () => {
      setLoading(true); setError(null)
      try {
        const params = new URLSearchParams()
        if (q.trim()) params.set('q', q.trim())
        if (staffOnly) params.set('kind', 'staff')
        const res = await fetch(`/api/messages/users/search?${params.toString()}`)
        const data = await res.json()
        if (!res.ok) {
          setError(typeof data.error === 'string' ? data.error : 'Search failed')
          return
        }
        setResults(data.results ?? [])
      } finally {
        setLoading(false)
      }
    }, 200)
    return () => clearTimeout(id)
  }, [q, open, staffOnly])

  async function start(peerUserId: string) {
    setCreating(peerUserId); setError(null)
    try {
      const res = await fetch('/api/messages/conversations', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ peer_user_id: peerUserId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not start conversation')
        return
      }
      setOpen(false)
      router.push(`${basePath}/${data.id}`)
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setCreating(null)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-20">
          <div className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">{label}</h3>
              <button onClick={() => setOpen(false)} className="rounded p-1 text-text-tertiary hover:bg-surface-raised">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={staffOnly ? 'Search staff…' : 'Search by name or phone…'}
                className="w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>

            {error && <p className="mt-2 text-[11px] text-danger">{error}</p>}

            <div className="mt-3 max-h-72 overflow-y-auto">
              {loading && (
                <div className="flex items-center justify-center py-6 text-xs text-text-tertiary">
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Searching…
                </div>
              )}
              {!loading && results.length === 0 && (
                <p className="py-6 text-center text-xs text-text-tertiary">
                  {q ? 'No matches' : 'Start typing to search'}
                </p>
              )}
              <ul className="divide-y divide-border">
                {results.map((r) => (
                  <li key={r.user_id}>
                    <button
                      onClick={() => start(r.user_id)}
                      disabled={!!creating}
                      className="flex w-full items-center gap-3 px-2 py-2.5 text-left hover:bg-surface-raised transition-colors disabled:opacity-60"
                    >
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        r.kind === 'staff' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {r.kind === 'staff' ? <Megaphone className="h-4 w-4" /> : <User className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text-primary">{r.display}</p>
                        {r.subtitle && (
                          <p className="truncate text-[11px] text-text-tertiary">{r.subtitle}</p>
                        )}
                      </div>
                      {creating === r.user_id && <Loader2 className="h-3.5 w-3.5 animate-spin text-text-tertiary" />}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
