'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

export function DeleteRoomButton({ id, label }: { id: string; label: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    const res = await fetch(`/api/rooms/${id}`, { method: 'DELETE' })
    if (res.ok) {
      router.refresh()
    } else {
      const body = await res.json().catch(() => null)
      setError(body?.error ?? 'Delete failed')
      setDeleting(false)
    }
  }

  if (confirming) {
    return (
      <div
        className="flex flex-col items-end gap-1"
        onClick={(e) => e.preventDefault()}
      >
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => { e.preventDefault(); handleDelete() }}
            disabled={deleting}
            className="rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
          <button
            onClick={(e) => { e.preventDefault(); setConfirming(false); setError(null) }}
            disabled={deleting}
            className="rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-text-secondary hover:bg-surface-raised transition-colors"
          >
            Cancel
          </button>
        </div>
        {error && (
          <p className="max-w-[220px] text-[11px] text-red-600">{error}</p>
        )}
      </div>
    )
  }

  return (
    <button
      onClick={(e) => { e.preventDefault(); setConfirming(true) }}
      title={`Delete ${label}`}
      className="rounded-md p-1 text-text-tertiary opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 transition-all"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )
}
