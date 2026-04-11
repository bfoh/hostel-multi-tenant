'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'

export function DeleteStaffButton({ staffId, staffName }: { staffId: string; staffName: string }) {
  const [status, setStatus] = useState<'idle' | 'confirm' | 'loading'>('idle')
  const router = useRouter()

  async function doDelete() {
    setStatus('loading')
    try {
      const res = await fetch(`/api/staff/${staffId}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        alert(d.error ?? 'Failed to delete')
        setStatus('idle')
        return
      }
      router.refresh()
    } catch {
      alert('Failed to delete')
      setStatus('idle')
    }
  }

  if (status === 'confirm') {
    return (
      <span className="flex items-center gap-1.5">
        <button
          onClick={doDelete}
          className="rounded px-2 py-1 text-[11px] font-semibold bg-danger text-white hover:bg-danger/90 transition-colors"
        >
          Yes, delete
        </button>
        <button
          onClick={() => setStatus('idle')}
          className="rounded px-2 py-1 text-[11px] text-text-secondary hover:text-text-primary transition-colors"
        >
          Cancel
        </button>
      </span>
    )
  }

  return (
    <button
      onClick={() => setStatus('confirm')}
      disabled={status === 'loading'}
      title={`Delete ${staffName}`}
      className="rounded p-1.5 text-text-disabled hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-40"
    >
      {status === 'loading'
        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
        : <Trash2 className="h-3.5 w-3.5" />
      }
    </button>
  )
}
