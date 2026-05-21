'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2 } from 'lucide-react'

interface Props {
  kind:         'vat_levies' | 'paye' | 'ssnit' | 'corporate'
  period_year:  number
  period_month: number | null
  due_date:     string
  amount_due:   number   // pesewas
  alreadyFiled: boolean
  label:        string
}

export function MarkFiledButton(props: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reference, setReference] = useState('')
  const [notes, setNotes]         = useState('')
  const [busy, setBusy]           = useState(false)
  const [error, setError]         = useState<string | null>(null)

  if (props.alreadyFiled) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
        <CheckCircle2 className="h-3 w-3" />
        {props.label} filed
      </span>
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/accounting/tax/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind:         props.kind,
          period_year:  props.period_year,
          period_month: props.period_month,
          due_date:     props.due_date,
          amount_due:   props.amount_due,
          reference:    reference.trim() || undefined,
          notes:        notes.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? `Failed (${res.status})`); setBusy(false); return }
      setOpen(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-text-secondary hover:bg-surface-raised hover:text-text-primary transition-colors"
      >
        <CheckCircle2 className="h-3 w-3" />
        Mark {props.label} filed
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-border bg-surface-raised p-3 space-y-2 max-w-sm">
      <p className="text-[11px] text-text-tertiary">
        Recording <strong className="text-text-primary">{props.label}</strong> filing for the selected period
      </p>
      <div>
        <label className="block text-[10px] text-text-tertiary mb-1">GRA receipt / reference</label>
        <input
          type="text"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="e.g. GRA-VAT-2026-04-12345"
          className="w-full rounded-lg border border-border bg-surface px-2 py-1 text-xs focus:border-brand focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-[10px] text-text-tertiary mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-border bg-surface px-2 py-1 text-xs focus:border-brand focus:outline-none"
        />
      </div>
      {error && <p className="text-[10px] text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {busy && <Loader2 className="h-3 w-3 animate-spin" />}
          Record filing
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null) }}
          className="rounded-lg border border-border bg-surface px-2.5 py-1 text-[11px] text-text-secondary hover:bg-surface-raised hover:text-text-primary transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
