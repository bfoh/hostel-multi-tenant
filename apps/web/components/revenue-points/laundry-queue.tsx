'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, Shirt, ArrowRight, RefreshCw, CheckCircle2 } from 'lucide-react'

interface Ticket {
  id:            string
  status:        'received' | 'washing' | 'ready' | 'collected'
  customer_name: string | null
  weight_kg:     number | null
  entry_token:   string | null
  total_amount:  number
  sold_at:       string
}

const NEXT_STATUS: Record<Ticket['status'], Ticket['status'] | null> = {
  received:  'washing',
  washing:   'ready',
  ready:     'collected',
  collected: null,
}

const STATUS_COLOR: Record<Ticket['status'], string> = {
  received:  'bg-info-subtle text-info border-info/20',
  washing:   'bg-warning-subtle text-warning-fg border-warning/20',
  ready:     'bg-success-subtle text-success border-success/20',
  collected: 'bg-surface-raised text-text-tertiary border-border',
}

const STATUS_LABEL: Record<Ticket['status'], string> = {
  received:  'Received',
  washing:   'Washing',
  ready:     'Ready',
  collected: 'Collected',
}

const NEXT_LABEL: Record<Ticket['status'], string> = {
  received:  'Start wash',
  washing:   'Mark ready',
  ready:     'Mark collected',
  collected: '—',
}

function ghs(p: number) {
  return `GH₵ ${(p / 100).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

export function LaundryQueue({ pointId }: { pointId: string }) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [advancingId, setAdvancingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/revenue-points/${pointId}/open-tickets`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setTickets(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }, [pointId])

  useEffect(() => { load() }, [load])

  async function advance(t: Ticket) {
    const next = NEXT_STATUS[t.status]
    if (!next) return
    setAdvancingId(t.id); setError(null)
    try {
      const res = await fetch(`/api/revenue-points/sales/${t.id}/status`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      if (next === 'collected') {
        setTickets((cur) => cur.filter((c) => c.id !== t.id))
      } else {
        setTickets((cur) => cur.map((c) => (c.id === t.id ? { ...c, status: next } : c)))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setAdvancingId(null)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <Shirt className="h-4 w-4" />
          Open laundry tickets
        </h2>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1 rounded-md border border-border bg-surface-raised px-2 py-1 text-[11px] font-medium text-text-secondary hover:bg-surface-sunken transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-danger-subtle px-3 py-2 text-xs text-danger">{error}</div>
      )}

      {!loading && tickets.length === 0 && (
        <p className="rounded-lg border border-dashed border-border py-8 text-center text-xs text-text-tertiary">
          No open tickets. New paid laundry orders will appear here.
        </p>
      )}

      {tickets.length > 0 && (
        <div className="divide-y divide-border">
          {tickets.map((t) => {
            const next   = NEXT_STATUS[t.status]
            const busy   = advancingId === t.id
            return (
              <div key={t.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLOR[t.status]}`}>
                      {STATUS_LABEL[t.status]}
                    </span>
                    {t.entry_token && (
                      <code className="rounded bg-surface-raised px-1.5 py-0.5 text-[11px] font-mono text-text-secondary tracking-wider">
                        {t.entry_token}
                      </code>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm font-medium text-text-primary">
                    {t.customer_name ?? '—'}
                    {t.weight_kg != null && (
                      <span className="ml-2 text-xs font-normal text-text-tertiary">
                        {Number(t.weight_kg).toFixed(2)} kg
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-text-tertiary">
                    {ghs(t.total_amount)} · {new Date(t.sold_at).toLocaleString()}
                  </p>
                </div>
                {next && (
                  <button
                    disabled={busy}
                    onClick={() => advance(t)}
                    className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-60"
                  >
                    {busy
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : next === 'collected' ? <CheckCircle2 className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
                    {NEXT_LABEL[t.status]}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
