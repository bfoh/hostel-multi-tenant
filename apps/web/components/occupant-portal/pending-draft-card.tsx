'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, Eye, X, Loader2 } from 'lucide-react'

interface Props {
  pending: {
    id:           string
    amount:       number
    draft_number: string | null
    created_at:   string
  }
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

export function PendingDraftCard({ pending }: Props) {
  const router = useRouter()
  const [viewLoading,   setViewLoading]   = useState(false)
  const [cancelling,    setCancelling]    = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [error,         setError]         = useState<string | null>(null)

  async function viewDraft() {
    setViewLoading(true); setError(null)
    try {
      const res  = await fetch(`/api/occupant/bank-draft/${pending.id}/url`)
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.url) throw new Error(data?.error ?? 'Could not open file')
      window.open(data.url, '_blank', 'noopener,noreferrer')
    } catch (e: any) { setError(e.message) }
    finally { setViewLoading(false) }
  }

  async function cancel() {
    setCancelling(true); setError(null)
    try {
      const res = await fetch(`/api/occupant/bank-draft/${pending.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'Cancel failed')
      }
      router.refresh()
    } catch (e: any) {
      setError(e.message)
      setCancelling(false)
    }
  }

  return (
    <div className="m-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100">
          <Clock className="h-4 w-4 text-amber-700" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-amber-900">Awaiting verification</p>
          <p className="text-[11px] text-amber-700">
            {pending.draft_number ? `Draft #${pending.draft_number} · ` : ''}{ghs(pending.amount)} · {timeAgo(pending.created_at)}
          </p>
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-red-700">{error}</p>}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={viewDraft}
          disabled={viewLoading}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 disabled:opacity-50"
        >
          {viewLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
          View draft
        </button>

        {!confirmCancel ? (
          <button
            onClick={() => setConfirmCancel(true)}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700"
          >
            <X className="h-3.5 w-3.5" /> Cancel submission
          </button>
        ) : (
          <button
            onClick={cancel}
            disabled={cancelling}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Tap again to confirm
          </button>
        )}
      </div>
    </div>
  )
}
