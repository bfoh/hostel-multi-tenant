'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

const TRANSITIONS: Record<string, { label: string; next: string; style: string }[]> = {
  available:   [{ label: 'Mark as Maintenance', next: 'maintenance', style: 'border border-border text-text-primary hover:bg-surface-raised' }],
  occupied:    [{ label: 'Mark Checkout Pending', next: 'available', style: 'border border-border text-text-primary hover:bg-surface-raised' }],
  reserved:    [{ label: 'Mark Available', next: 'available', style: 'border border-border text-text-primary hover:bg-surface-raised' }],
  maintenance: [{ label: 'Mark Available', next: 'available', style: 'bg-success text-success-fg hover:opacity-90' }],
  blocked:     [{ label: 'Unblock Room', next: 'available', style: 'bg-brand text-brand-fg hover:bg-brand-hover' }],
}

interface Props {
  roomId: string
  currentStatus: string
}

export function RoomStatusActions({ roomId, currentStatus }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const actions = TRANSITIONS[currentStatus] ?? []

  if (actions.length === 0) return null

  async function updateStatus(nextStatus: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/rooms/${roomId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (res.ok) router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {actions.map((action) => (
          <button
            key={action.next}
            disabled={loading}
            onClick={() => updateStatus(action.next)}
            className={`w-full rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${action.style}`}
          >
            {loading ? 'Updating…' : action.label}
          </button>
        ))}
      </CardContent>
    </Card>
  )
}
