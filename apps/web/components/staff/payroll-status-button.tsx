'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ChevronDown } from 'lucide-react'

const TRANSITIONS: Record<string, { next: string; label: string; style: string }> = {
  draft:    { next: 'approved', label: 'Approve payroll',  style: 'bg-brand text-brand-fg hover:bg-brand-hover' },
  approved: { next: 'paid',     label: 'Mark as paid',     style: 'bg-success text-white hover:opacity-90' },
}

export function PayrollStatusButton({
  runId,
  currentStatus,
}: {
  runId: string
  currentStatus: string
}) {
  const router   = useRouter()
  const [loading, setLoading] = useState(false)
  const transition = TRANSITIONS[currentStatus]

  if (!transition) {
    return (
      <span className="flex items-center gap-1.5 text-sm text-success font-medium">
        <CheckCircle2 className="h-4 w-4" /> Paid
      </span>
    )
  }

  async function advance() {
    setLoading(true)
    const res = await fetch(`/api/payroll/${runId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: transition.next }),
    })
    if (res.ok) {
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <button
      onClick={advance}
      disabled={loading}
      className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${transition.style}`}
    >
      {loading ? 'Updating…' : transition.label}
    </button>
  )
}
