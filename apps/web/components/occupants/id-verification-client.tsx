'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle, XCircle, AlertCircle, Loader2, FileText, ExternalLink } from 'lucide-react'
import { initials } from '@/lib/utils'

interface OccupantDoc { id: string; document_type?: string; file_url?: string; created_at: string }
interface QueueOccupant {
  id: string
  first_name: string; last_name: string
  phone?: string; email?: string; photo_url?: string; student_id?: string
  id_verified: boolean; id_rejection_notes?: string | null
  occupant_documents: OccupantDoc[]
}
interface Review {
  id: string; decision: string; notes?: string; created_at: string
  occupants?: { first_name: string; last_name: string } | null
}

const DECISION_LABEL: Record<string, string> = {
  approved:           'Approved',
  rejected:           'Rejected',
  needs_resubmission: 'Needs resubmission',
}
const DECISION_STYLES: Record<string, string> = {
  approved:           'bg-success-subtle text-success border-success/20',
  rejected:           'bg-danger-subtle text-danger border-danger/20',
  needs_resubmission: 'bg-warning-subtle text-warning-fg border-warning/20',
}

export function IdVerificationClient({
  initialQueue,
  recentReviews,
}: {
  initialQueue: QueueOccupant[]
  recentReviews: Review[]
}) {
  const [queue, setQueue]   = useState(initialQueue)
  const [reviews, setReviews] = useState(recentReviews)
  const [saving, setSaving] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [error, setError]   = useState<string | null>(null)

  // Per-occupant review state
  const [decision, setDecision] = useState<Record<string, string>>({})
  const [notes, setNotes]       = useState<Record<string, string>>({})
  const [docId, setDocId]       = useState<Record<string, string>>({})

  async function submit(occupant: QueueOccupant) {
    const dec = decision[occupant.id]
    if (!dec) { setError('Select a decision'); return }
    setSaving(occupant.id); setError(null)
    try {
      const res = await fetch(`/api/id-verification/${occupant.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision:    dec,
          document_id: docId[occupant.id] || undefined,
          notes:       notes[occupant.id] || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      // Remove from queue if approved; keep if rejected/needs_resubmission (they stay unverified)
      if (dec === 'approved') {
        setQueue((prev) => prev.filter((o) => o.id !== occupant.id))
      }
      setExpanded(null)
      // Add to recent reviews
      setReviews((prev) => [{
        ...data,
        occupants: { first_name: occupant.first_name, last_name: occupant.last_name },
      }, ...prev.slice(0, 19)])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* ── Queue ─────────────────────────────────────────────────── */}
      <div className="space-y-4 lg:col-span-2">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
            <CheckCircle className="h-12 w-12 text-success" />
            <p className="font-semibold text-text-primary">All clear!</p>
            <p className="text-sm text-text-secondary">No occupants are awaiting ID verification</p>
          </div>
        ) : (
          queue.map((occ) => {
            const docs = Array.isArray(occ.occupant_documents) ? occ.occupant_documents : []
            const isOpen = expanded === occ.id
            return (
              <div key={occ.id} className="rounded-xl border border-border bg-surface overflow-hidden">
                {/* Header */}
                <button
                  onClick={() => setExpanded(isOpen ? null : occ.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-raised transition-colors"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-sm font-semibold text-brand">
                    {occ.photo_url
                      ? <img src={occ.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                      : initials(`${occ.first_name} ${occ.last_name}`)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-text-primary text-sm">
                      {occ.first_name} {occ.last_name}
                    </p>
                    <p className="text-xs text-text-tertiary">{occ.phone ?? occ.email}</p>
                    {occ.student_id && <p className="ref-number text-[11px] text-text-disabled">{occ.student_id}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="rounded-full bg-warning-subtle border border-warning/20 px-2 py-0.5 text-[11px] font-medium text-warning-fg">
                      {docs.length} doc{docs.length !== 1 ? 's' : ''}
                    </span>
                    <Link
                      href={`/occupants/${occ.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-brand hover:underline"
                    >
                      Profile
                    </Link>
                  </div>
                </button>

                {/* Expanded review panel */}
                {isOpen && (
                  <div className="border-t border-border bg-surface-raised px-4 py-4 space-y-4">
                    {/* Documents */}
                    <div>
                      <p className="mb-2 text-xs font-medium text-text-tertiary">Uploaded documents</p>
                      <div className="space-y-2">
                        {docs.map((doc) => (
                          <div key={doc.id} className={`flex items-center justify-between gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${docId[occ.id] === doc.id ? 'border-brand bg-brand-subtle' : 'border-border bg-surface hover:bg-surface-raised'}`}
                            onClick={() => setDocId((prev) => ({ ...prev, [occ.id]: doc.id }))}
                          >
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-text-disabled shrink-0" />
                              <div>
                                <p className="text-sm font-medium text-text-primary capitalize">
                                  {(doc.document_type ?? 'document').replace('_', ' ')}
                                </p>
                                <p className="text-xs text-text-tertiary">
                                  {new Date(doc.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            {doc.file_url && (
                              <a
                                href={doc.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs text-brand hover:underline flex items-center gap-1"
                              >
                                View <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Decision */}
                    <div>
                      <p className="mb-2 text-xs font-medium text-text-tertiary">Decision</p>
                      <div className="grid grid-cols-3 gap-2">
                        {(['approved', 'rejected', 'needs_resubmission'] as const).map((d) => (
                          <button
                            key={d}
                            onClick={() => setDecision((prev) => ({ ...prev, [occ.id]: d }))}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                              decision[occ.id] === d
                                ? 'border-brand bg-brand text-brand-fg'
                                : 'border-border bg-surface text-text-secondary hover:border-brand/40'
                            }`}
                          >
                            {DECISION_LABEL[d]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <textarea
                      value={notes[occ.id] ?? ''}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [occ.id]: e.target.value }))}
                      placeholder="Notes for occupant (optional)"
                      rows={2}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand resize-none"
                    />

                    {error && <p className="text-xs text-danger">{error}</p>}

                    <div className="flex gap-2">
                      <button
                        onClick={() => submit(occ)}
                        disabled={saving === occ.id || !decision[occ.id]}
                        className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-60"
                      >
                        {saving === occ.id && <Loader2 className="h-4 w-4 animate-spin" />}
                        Submit decision
                      </button>
                      <button
                        onClick={() => setExpanded(null)}
                        className="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:bg-surface transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* ── Recent reviews ────────────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-text-primary">Recent Reviews</h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-text-tertiary">No reviews yet</p>
        ) : (
          <div className="space-y-2">
            {reviews.map((r) => {
              const occ = r.occupants
              return (
                <div key={r.id} className="rounded-lg border border-border bg-surface p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary">
                        {occ ? `${occ.first_name} ${occ.last_name}` : 'Unknown'}
                      </p>
                      {r.notes && <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{r.notes}</p>}
                      <p className="text-xs text-text-tertiary mt-1">{new Date(r.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${DECISION_STYLES[r.decision]}`}>
                      {r.decision === 'approved' && <CheckCircle className="inline h-3 w-3 mr-0.5" />}
                      {r.decision === 'rejected' && <XCircle className="inline h-3 w-3 mr-0.5" />}
                      {r.decision === 'needs_resubmission' && <AlertCircle className="inline h-3 w-3 mr-0.5" />}
                      {DECISION_LABEL[r.decision]}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
