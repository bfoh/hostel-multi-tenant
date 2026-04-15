'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

export function DeleteCategoryButton({ id, name }: { id: string; name: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    const res = await fetch(`/api/room-categories/${id}`, { method: 'DELETE' })
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
      <div className="ml-4 flex shrink-0 flex-col items-end gap-1">
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {deleting ? 'Deleting…' : 'Confirm'}
          </button>
          <button
            onClick={() => { setConfirming(false); setError(null) }}
            disabled={deleting}
            className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-raised transition-colors"
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
      onClick={() => setConfirming(true)}
      title={`Delete ${name}`}
      className="ml-2 shrink-0 rounded-md border border-border p-1.5 text-text-tertiary hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )
}
