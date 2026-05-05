'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Clock, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import { DraftReviewPanel } from './draft-review-panel'

interface PendingRow {
  id:                  string
  amount:              number
  draft_number:        string | null
  draft_bank_name:     string | null
  draft_deposit_date:  string | null
  draft_note:          string | null
  draft_file_path:     string | null
  created_at:          string
  booking: {
    id:           string
    booking_ref:  string
    final_amount: number
    paid_amount:  number
    occupant:     { id: string; first_name: string; last_name: string; phone: string | null } | null
    room:         { room_number: string | null; block: string | null } | null
  }
}

interface ProcessedRow {
  id:               string
  amount:           number
  status:           'success' | 'failed'
  draft_number:     string | null
  draft_bank_name:  string | null
  approved_at:      string | null
  approved_by:      string | null
  rejected_at:      string | null
  rejected_by:      string | null
  rejected_reason:  string | null
  created_at:       string
  booking:          { booking_ref: string; occupant: { first_name: string; last_name: string } | null }
}

interface Props {
  tenantId:                 string
  initialPending:           PendingRow[]
  initialRecentlyProcessed: ProcessedRow[]
}

function ghs(pesewas: number) {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(pesewas / 100)
}
function timeAgo(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (sec < 60)        return `${sec}s ago`
  if (sec < 3600)      return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400)     return `${Math.floor(sec / 3600)}h ago`
  return `${Math.floor(sec / 86400)}d ago`
}
function isStale(iso: string) {
  return Date.now() - new Date(iso).getTime() > 24 * 60 * 60 * 1000
}

export function DraftQueue({ tenantId, initialPending, initialRecentlyProcessed }: Props) {
  const [pending, setPending] = useState<PendingRow[]>(initialPending)
  const [processed] = useState<ProcessedRow[]>(initialRecentlyProcessed)
  const [showProcessed, setShowProcessed] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reconnecting, setReconnecting] = useState(false)
  const supabaseRef = useRef(createClient())

  const refreshAll = useCallback(async () => {
    const sb = supabaseRef.current
    const { data: fresh } = await sb
      .from('booking_payments')
      .select(`
        id, amount, draft_number, draft_bank_name, draft_deposit_date, draft_note,
        draft_file_path, created_at,
        booking:bookings!inner(
          id, booking_ref, final_amount, paid_amount,
          occupant:occupants(id, first_name, last_name, phone),
          room:rooms(room_number, block)
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('method', 'bank_draft' as any)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
    setPending((fresh as unknown as PendingRow[]) ?? [])
  }, [tenantId])

  useEffect(() => {
    const sb = supabaseRef.current
    const channel = sb
      .channel(`tenant-drafts-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'booking_payments',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => { refreshAll() },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED')                setReconnecting(false)
        else if (status === 'CHANNEL_ERROR' ||
                 status === 'TIMED_OUT')            setReconnecting(true)
      })
    return () => { sb.removeChannel(channel) }
  }, [tenantId, refreshAll])

  const selected = pending.find(p => p.id === selectedId) ?? null

  return (
    <div className="relative">
      {reconnecting && (
        <div className="mb-3 rounded-lg bg-amber-50 px-4 py-2 text-xs text-amber-800">
          Reconnecting to live updates…
        </div>
      )}

      <p className="mb-3 text-sm text-slate-600">
        <span className="font-semibold text-slate-900">{pending.length}</span> pending · sorted oldest first
      </p>

      {pending.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="grid grid-cols-[40px_1.6fr_1fr_1fr_1fr_1fr_1.2fr] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <div></div>
            <div>Resident</div>
            <div>Amount</div>
            <div>Draft #</div>
            <div>Bank</div>
            <div>Deposit date</div>
            <div>Submitted</div>
          </div>

          {pending.map(row => {
            const stale = isStale(row.created_at)
            const occ = row.booking.occupant
            const room = row.booking.room
            return (
              <button
                key={row.id}
                onClick={() => setSelectedId(row.id)}
                className={`grid w-full grid-cols-[40px_1.6fr_1fr_1fr_1fr_1fr_1.2fr] gap-3 border-b border-slate-100 px-4 py-3 text-left text-sm hover:bg-slate-50 ${selectedId === row.id ? 'bg-blue-50' : ''}`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-700">
                  {(occ?.first_name?.[0] ?? '?')}{(occ?.last_name?.[0] ?? '')}
                </div>
                <div>
                  <div className="font-semibold text-slate-900">{occ?.first_name} {occ?.last_name}</div>
                  <div className="text-[10px] text-slate-400">
                    {room?.room_number ? `Room ${room.room_number}${room.block ? ' · ' + room.block : ''} · ` : ''}{row.booking.booking_ref}
                  </div>
                </div>
                <div className="font-mono font-bold text-slate-900">{ghs(row.amount)}</div>
                <div className="font-mono text-slate-700">{row.draft_number ?? '—'}</div>
                <div className="text-slate-700">{row.draft_bank_name ?? '—'}</div>
                <div className="text-slate-700">{row.draft_deposit_date ?? '—'}</div>
                <div className={`flex items-center gap-1 text-xs ${stale ? 'font-semibold text-red-600' : 'text-slate-500'}`}>
                  <Clock className="h-3.5 w-3.5" />
                  {timeAgo(row.created_at)}
                  {stale && <AlertTriangle className="h-3.5 w-3.5" />}
                </div>
              </button>
            )
          })}
        </div>
      )}

      <div className="mt-6">
        <button
          onClick={() => setShowProcessed(s => !s)}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:bg-slate-50"
        >
          {showProcessed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          Recently processed (last 24h) · {processed.length}
        </button>

        {showProcessed && (
          <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {processed.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-slate-400">No drafts processed yet.</p>
            )}
            {processed.map(p => (
              <div key={p.id} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 text-sm">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${p.status === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {p.status === 'success' ? 'Approved' : 'Rejected'}
                </span>
                <span className="font-medium text-slate-800">{p.booking.occupant?.first_name} {p.booking.occupant?.last_name}</span>
                <span className="font-mono text-slate-700">{ghs(p.amount)}</span>
                <span className="text-[10px] text-slate-400">{p.booking.booking_ref}</span>
                {p.status === 'failed' && p.rejected_reason && (
                  <span className="truncate text-[11px] text-red-600" title={p.rejected_reason}>{p.rejected_reason}</span>
                )}
                {p.status === 'success' && p.approved_at && (
                  <UndoLink id={p.id} approvedAt={p.approved_at} onUndo={refreshAll} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <DraftReviewPanel
          row={selected}
          onClose={() => setSelectedId(null)}
          onProcessed={() => { setSelectedId(null); refreshAll() }}
        />
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
      <Clock className="mx-auto h-8 w-8 text-slate-300" />
      <p className="mt-2 text-sm font-medium text-slate-500">No pending drafts</p>
      <p className="mt-1 text-xs text-slate-400">New uploads will appear here automatically.</p>
    </div>
  )
}

/**
 * 5-minute Undo link. Hides itself client-side once the window expires;
 * server-side route enforces the same window and returns 410 if abused.
 */
function UndoLink({ id, approvedAt, onUndo }: { id: string; approvedAt: string; onUndo: () => void }) {
  const FIVE_MIN = 5 * 60 * 1000
  const [remaining, setRemaining] = useState(() => Math.max(0, FIVE_MIN - (Date.now() - new Date(approvedAt).getTime())))
  const [busy,      setBusy]      = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  useEffect(() => {
    if (remaining <= 0) return
    const t = setInterval(() => {
      setRemaining(r => Math.max(0, r - 1000))
    }, 1000)
    return () => clearInterval(t)
  }, [remaining])

  if (remaining <= 0) return null

  const sec = Math.ceil(remaining / 1000)
  const label = sec >= 60 ? `${Math.ceil(sec / 60)}m` : `${sec}s`

  async function undo() {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/bank-drafts/${id}/undo`, { method: 'POST' })
      if (!res.ok) {
        const d = await res.json().catch(() => null)
        throw new Error(d?.error ?? 'Undo failed')
      }
      onUndo()
    } catch (e: any) {
      setError(e.message); setBusy(false)
    }
  }

  return (
    <div className="ml-auto flex items-center gap-2">
      {error && <span className="text-[10px] text-red-600">{error}</span>}
      <button
        onClick={undo}
        disabled={busy}
        className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        title={`Undo within ${label}`}
      >
        Undo · {label}
      </button>
    </div>
  )
}
