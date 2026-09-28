'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Star } from 'lucide-react'

export function FeedbackReviewActions({
  feedbackId,
  status,
  featured,
}: {
  feedbackId: string
  status:     'pending' | 'approved' | 'rejected'
  featured:   boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  async function patch(body: Record<string, unknown>, key: string) {
    setLoading(key)
    try {
      const res = await fetch(`/api/reports/feedback/${feedbackId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) router.refresh()
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      {status !== 'approved' && (
        <button
          onClick={() => patch({ status: 'approved' }, 'approve')}
          disabled={loading !== null}
          className="flex items-center gap-1 rounded-md border border-success/30 bg-success-subtle px-2 py-1 text-xs font-medium text-success transition-colors hover:bg-success/20 disabled:opacity-50"
        >
          <Check className="h-3 w-3" /> Approve
        </button>
      )}
      {status !== 'rejected' && (
        <button
          onClick={() => patch({ status: 'rejected' }, 'reject')}
          disabled={loading !== null}
          className="flex items-center gap-1 rounded-md border border-danger/30 bg-danger-subtle px-2 py-1 text-xs font-medium text-danger transition-colors hover:bg-danger/20 disabled:opacity-50"
        >
          <X className="h-3 w-3" /> Reject
        </button>
      )}
      <button
        onClick={() => patch({ featured: !featured }, 'feature')}
        disabled={loading !== null}
        className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
          featured
            ? 'border-warning/30 bg-warning-subtle text-warning-fg hover:bg-warning/20'
            : 'border-border bg-surface text-text-secondary hover:bg-surface-raised'
        }`}
      >
        <Star className={`h-3 w-3 ${featured ? 'fill-current' : ''}`} />
        {featured ? 'Featured' : 'Feature'}
      </button>
    </div>
  )
}
