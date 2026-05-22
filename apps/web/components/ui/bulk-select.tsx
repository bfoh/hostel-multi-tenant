'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2, X, CheckSquare } from 'lucide-react'

/**
 * Headless bulk-selection hook + a ready-made action bar. Wire any list page:
 *
 *   const bulk = useBulkSelect(items.map(i => i.id))
 *   ...
 *   <BulkActionBar bulk={bulk} resource="occupants" itemNoun="resident" />
 *   ...
 *   {bulk.selectMode && <input type="checkbox" checked={bulk.isSelected(id)}
 *                              onChange={() => bulk.toggle(id)} />}
 */
export function useBulkSelect(allIds: string[]) {
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected]     = useState<Set<string>>(new Set())

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const isSelected = useCallback((id: string) => selected.has(id), [selected])

  const allSelected = allIds.length > 0 && selected.size === allIds.length

  const toggleAll = useCallback(() => {
    setSelected(allSelected ? new Set() : new Set(allIds))
  }, [allSelected, allIds])

  const reset = useCallback(() => {
    setSelectMode(false)
    setSelected(new Set())
  }, [])

  return {
    selectMode, setSelectMode,
    selected, isSelected, toggle, toggleAll, allSelected, reset,
    count: selected.size,
  }
}

export type BulkSelect = ReturnType<typeof useBulkSelect>

export function BulkActionBar({
  bulk,
  resource,
  itemNoun = 'item',
}: {
  bulk:     BulkSelect
  resource: string
  itemNoun?: string
}) {
  const router = useRouter()
  const [busy, setBusy]   = useState(false)
  const [msg, setMsg]     = useState<string | null>(null)

  async function bulkDelete() {
    if (bulk.count === 0) return
    if (!confirm(`Delete ${bulk.count} ${itemNoun}${bulk.count === 1 ? '' : 's'}? This cannot be undone.`)) return
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource, ids: Array.from(bulk.selected) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg(data.error ?? `Failed (${res.status})`); setBusy(false); return }
      if (data.blocked > 0) {
        setMsg(`${data.deleted} deleted · ${data.blocked} skipped`)
      }
      bulk.reset()
      router.refresh()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  if (!bulk.selectMode) {
    return (
      <button
        type="button"
        onClick={() => bulk.setSelectMode(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-raised hover:text-text-primary transition-colors"
      >
        <CheckSquare className="h-4 w-4" />
        Select
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {bulk.count > 0 && (
        <span className="text-sm text-text-secondary">{bulk.count} selected</span>
      )}
      <button
        type="button"
        onClick={bulk.toggleAll}
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-raised hover:text-text-primary transition-colors"
      >
        {bulk.allSelected ? 'Clear all' : 'Select all'}
      </button>
      <button
        type="button"
        onClick={bulkDelete}
        disabled={busy || bulk.count === 0}
        className="inline-flex items-center gap-1.5 rounded-md bg-danger px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        Delete{bulk.count > 0 ? ` (${bulk.count})` : ''}
      </button>
      <button
        type="button"
        onClick={bulk.reset}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-raised hover:text-text-primary transition-colors"
      >
        <X className="h-4 w-4" />
        Cancel
      </button>
      {msg && <span className="text-xs text-warning-fg">{msg}</span>}
    </div>
  )
}
