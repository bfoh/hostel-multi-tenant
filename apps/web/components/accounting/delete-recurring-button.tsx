'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'

export function DeleteRecurringButton({
  id, kind, name,
}: {
  id:   string
  kind: 'bills' | 'journals'
  name: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function remove() {
    if (!confirm(`Delete recurring template "${name}"? Already-generated entries are not affected.`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/accounting/recurring/${kind}/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error ?? `Failed (${res.status})`)
        return
      }
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={busy}
      aria-label="Delete"
      className="rounded p-1 text-text-tertiary hover:bg-danger/10 hover:text-danger disabled:opacity-50 transition-colors"
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
    </button>
  )
}
