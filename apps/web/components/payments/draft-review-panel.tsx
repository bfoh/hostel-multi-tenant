'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, AlertTriangle } from 'lucide-react'

interface Row {
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
  }
}

interface Props {
  row:         Row
  onClose:     () => void
  onProcessed: () => void
}

function ghs(pesewas: number) {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(pesewas / 100)
}

export function DraftReviewPanel({ row, onClose, onProcessed }: Props) {
  const [signedUrl, setSignedUrl]   = useState<string | null>(null)
  const [busy,      setBusy]        = useState<'approve' | 'reject' | null>(null)
  const [error,     setError]       = useState<string | null>(null)
  const [rejectMode, setRejectMode] = useState(false)
  const [reason,    setReason]      = useState('')

  useEffect(() => {
    let cancelled = false
    setSignedUrl(null)
    fetch(`/api/bank-drafts/${row.id}/url`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setSignedUrl(d?.url ?? null) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [row.id])

  const balance     = Math.max(0, row.booking.final_amount - row.booking.paid_amount)
  const overpayment = row.amount > balance
  const occ         = row.booking.occupant
  const isPdf       = row.draft_file_path?.toLowerCase().endsWith('.pdf')

  async function approve() {
    setBusy('approve'); setError(null)
    try {
      const res = await fetch(`/api/bank-drafts/${row.id}/approve`, { method: 'POST' })
      if (!res.ok) {
        const d = await res.json().catch(() => null)
        throw new Error(d?.error ?? 'Approve failed')
      }
      onProcessed()
    } catch (e: any) {
      setError(e.message); setBusy(null)
    }
  }

  async function submitReject() {
    if (reason.trim().length < 3) { setError('Reason is required (min 3 chars)'); return }
    setBusy('reject'); setError(null)
    try {
      const res = await fetch(`/api/bank-drafts/${row.id}/reject`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ reason: reason.trim() }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => null)
        throw new Error(d?.error ?? 'Reject failed')
      }
      onProcessed()
    } catch (e: any) {
      setError(e.message); setBusy(null)
    }
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40 bg-slate-900/30" />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-[380px] flex-col bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h3 className="text-sm font-bold text-slate-900">Review draft</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-slate-100"><X className="h-4 w-4 text-slate-500" /></button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-4 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            {signedUrl ? (
              isPdf ? (
                <iframe src={signedUrl} className="h-48 w-full" title="Bank draft preview" />
              ) : (
                <a href={signedUrl} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={signedUrl} className="h-48 w-full object-cover" alt="Bank draft" />
                </a>
              )
            ) : (
              <div className="flex h-48 items-center justify-center text-xs text-slate-400">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading preview…
              </div>
            )}
          </div>

          <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Outstanding balance on this booking
            <div className="mt-1 text-base font-bold text-amber-950">{ghs(balance)}</div>
          </div>

          {overpayment && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              This will create a credit of {ghs(row.amount - balance)} on the booking.
            </div>
          )}

          <dl className="grid grid-cols-2 gap-3 text-xs">
            <Pair label="Resident"     value={`${occ?.first_name ?? ''} ${occ?.last_name ?? ''}`.trim() || '—'} />
            <Pair label="Booking"      value={row.booking.booking_ref} mono />
            <Pair label="Amount"       value={ghs(row.amount)} mono />
            <Pair label="Draft #"      value={row.draft_number ?? '—'} mono />
            <Pair label="Bank"         value={row.draft_bank_name ?? '—'} />
            <Pair label="Deposit date" value={row.draft_deposit_date ?? '—'} />
          </dl>

          {row.draft_note && (
            <div className="mt-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Resident note</p>
              <p className="mt-1 rounded bg-slate-50 px-3 py-2 text-xs text-slate-700">&ldquo;{row.draft_note}&rdquo;</p>
            </div>
          )}

          <p className="mt-4 rounded bg-blue-50 px-3 py-2 text-[11px] text-blue-900">
            Approval marks this payment <strong>success</strong>, updates the booking&apos;s paid amount, and posts a journal entry. Resident receives push + SMS.
          </p>

          {rejectMode && (
            <div className="mt-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Rejection reason (required)</p>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={3}
                maxLength={500}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                placeholder="e.g. Bank statement does not show this deposit"
              />
            </div>
          )}

          {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        </div>

        <footer className="grid grid-cols-2 gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          {!rejectMode ? (
            <>
              <button
                onClick={() => setRejectMode(true)}
                className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50"
              >
                Reject
              </button>
              <button
                onClick={approve}
                disabled={busy === 'approve'}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {busy === 'approve' && <Loader2 className="h-4 w-4 animate-spin" />}
                ✓ Approve {ghs(row.amount)}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setRejectMode(false); setReason(''); setError(null) }} className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-slate-700">
                Back
              </button>
              <button onClick={submitReject} disabled={busy === 'reject'} className="flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
                {busy === 'reject' && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm reject
              </button>
            </>
          )}
        </footer>
      </aside>
    </>
  )
}

function Pair({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-0.5 text-sm font-semibold text-slate-900 ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  )
}
