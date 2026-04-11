'use client'

import { useState, useTransition } from 'react'
import { CheckCircle, XCircle, Edit3, RotateCcw, ExternalLink, ChevronDown } from 'lucide-react'
import { formatGHS } from '@/lib/utils'
import type { StatementRow } from '@/lib/data/reconciliation'

type Tab = 'all' | 'unmatched' | 'matched' | 'excluded' | 'manual'

const STATUS_BADGE: Record<StatementRow['status'], { label: string; cls: string }> = {
  matched:   { label: 'Matched',   cls: 'bg-success/10 text-success' },
  unmatched: { label: 'Unmatched', cls: 'bg-warning/10 text-warning' },
  excluded:  { label: 'Excluded',  cls: 'bg-surface-raised text-text-tertiary' },
  manual:    { label: 'Manual',    cls: 'bg-brand/10 text-brand' },
}

interface Props {
  rows: StatementRow[]
}

export function ReconReviewTable({ rows }: Props) {
  const [tab,    setTab]    = useState<Tab>('all')
  const [notes,  setNotes]  = useState<Record<string, string>>({})
  const [open,   setOpen]   = useState<string | null>(null)
  const [, start]           = useTransition()

  const filtered = tab === 'all' ? rows : rows.filter((r) => r.status === tab)

  const counts: Record<Tab, number> = {
    all:       rows.length,
    unmatched: rows.filter((r) => r.status === 'unmatched').length,
    matched:   rows.filter((r) => r.status === 'matched').length,
    excluded:  rows.filter((r) => r.status === 'excluded').length,
    manual:    rows.filter((r) => r.status === 'manual').length,
  }

  async function patch(id: string, status: StatementRow['status'], noteText?: string) {
    await fetch(`/api/reconcile/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notes: noteText ?? null }),
    })
    // Reload to reflect updated data
    start(() => { window.location.reload() })
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'all',       label: 'All' },
    { key: 'unmatched', label: 'Unmatched' },
    { key: 'matched',   label: 'Matched' },
    { key: 'excluded',  label: 'Excluded' },
    { key: 'manual',    label: 'Manual' },
  ]

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-border bg-surface-raised p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t.key
                ? 'bg-surface text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {t.label}
            <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              tab === t.key ? 'bg-brand/10 text-brand' : 'bg-border text-text-tertiary'
            }`}>
              {counts[t.key]}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <p className="text-sm text-text-secondary">No rows in this category.</p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-surface overflow-hidden">
          {filtered.map((row) => {
            const badge    = STATUS_BADGE[row.status]
            const isOpen   = open === row.id
            const noteText = notes[row.id] ?? row.notes ?? ''

            return (
              <div key={row.id} className="text-sm">
                {/* Row summary */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-text-primary truncate">{row.description}</span>
                      {row.reference && (
                        <span className="shrink-0 font-mono text-[11px] text-text-tertiary">
                          {row.reference}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-text-secondary">
                      {new Date(row.txn_date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    {row.credit > 0 && (
                      <p className="font-semibold text-success currency-amount">{formatGHS(row.credit)}</p>
                    )}
                    {row.debit > 0 && (
                      <p className="font-semibold text-danger currency-amount">−{formatGHS(row.debit)}</p>
                    )}
                  </div>

                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.cls}`}>
                    {badge.label}
                  </span>

                  <button
                    onClick={() => setOpen(isOpen ? null : row.id)}
                    className="shrink-0 rounded-lg p-1 text-text-tertiary hover:bg-surface-raised hover:text-text-primary transition-colors"
                    aria-label="Actions"
                  >
                    <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {/* Expanded actions */}
                {isOpen && (
                  <div className="border-t border-border bg-surface-raised px-4 py-4 space-y-3">
                    {/* Matched entry link */}
                    {row.matched_entry_id && (
                      <a
                        href={`/accounting/journal`}
                        className="inline-flex items-center gap-1.5 text-xs text-brand hover:opacity-75"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        View matched journal entry
                      </a>
                    )}

                    {/* Notes */}
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">Notes</label>
                      <textarea
                        rows={2}
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-primary placeholder-text-tertiary focus:border-brand focus:outline-none resize-none"
                        placeholder="Optional note…"
                        value={noteText}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [row.id]: e.target.value }))}
                      />
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2">
                      {row.status !== 'matched' && (
                        <button
                          onClick={() => patch(row.id, 'matched', noteText)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-1.5 text-xs font-medium text-success hover:bg-success/20 transition-colors"
                        >
                          <CheckCircle className="h-3.5 w-3.5" /> Mark matched
                        </button>
                      )}
                      {row.status !== 'manual' && (
                        <button
                          onClick={() => patch(row.id, 'manual', noteText)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-brand/10 px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand/20 transition-colors"
                        >
                          <Edit3 className="h-3.5 w-3.5" /> Mark manual
                        </button>
                      )}
                      {row.status !== 'excluded' && (
                        <button
                          onClick={() => patch(row.id, 'excluded', noteText)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary border border-border hover:bg-surface-raised transition-colors"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Exclude
                        </button>
                      )}
                      {row.status !== 'unmatched' && (
                        <button
                          onClick={() => patch(row.id, 'unmatched', noteText)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 text-xs font-medium text-text-tertiary border border-border hover:bg-surface-raised transition-colors"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Reset
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
