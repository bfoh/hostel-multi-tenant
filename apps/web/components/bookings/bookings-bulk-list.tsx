'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, CheckSquare, Square, CheckCheck, Trash2, Pencil } from 'lucide-react'
import { formatGHS, formatDate } from '@/lib/utils'

interface Booking {
  id: string
  booking_ref: string
  status: string
  payment_status: string
  check_in_date: string
  final_amount: number
  occupant: { first_name: string; last_name: string; phone?: string } | null
  room: { room_number: string; category?: { name: string } | null } | null
}

const STATUS_STYLES: Record<string, string> = {
  pending_payment: 'bg-warning-subtle text-warning-fg border-warning/20',
  confirmed:       'bg-brand-subtle text-brand border-brand/20',
  checked_in:      'bg-success-subtle text-success border-success/20',
  checked_out:     'bg-surface-sunken text-text-secondary border-border',
  cancelled:       'bg-danger-subtle text-danger border-danger/20',
  no_show:         'bg-danger-subtle text-danger border-danger/20',
  enquiry:         'bg-info-subtle text-info border-info/20',
}

const PAYMENT_STYLES: Record<string, string> = {
  unpaid:   'text-danger',
  partial:  'text-warning',
  paid:     'text-success',
  refunded: 'text-info',
}

const BULK_STATUSES = [
  { value: 'confirmed',       label: 'Confirm' },
  { value: 'checked_in',      label: 'Check In' },
  { value: 'checked_out',     label: 'Check Out' },
  { value: 'cancelled',       label: 'Cancel' },
  { value: 'pending_payment', label: 'Pending Payment' },
]

export function BookingsBulkList({
  bookings,
  canManage = false,
}: {
  bookings: Booking[]
  canManage?: boolean
}) {
  const router = useRouter()
  const [selected, setSelected]  = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [error, setError]        = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const allSelected = bookings.length > 0 && selected.size === bookings.length

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(bookings.map((b) => b.id)))
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function deleteSingle(id: string) {
    if (!confirm('Delete this booking? This cannot be undone.')) return
    setDeletingId(id)
    try {
      const res = await fetch('/api/bookings/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id], action: 'delete' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? 'Delete failed')
      } else {
        startTransition(() => router.refresh())
      }
    } catch {
      setError('Network error')
    }
    setDeletingId(null)
  }

  async function bulkAction(action: string, value?: string) {
    setError(null)
    const ids = Array.from(selected)
    if (ids.length === 0) return

    try {
      const res = await fetch('/api/bookings/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action, value }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Bulk action failed')
        return
      }
      setSelected(new Set())
      startTransition(() => router.refresh())
    } catch {
      setError('Network error')
    }
  }

  return (
    <div>
      {/* Bulk toolbar */}
      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-brand/30 bg-brand/5 px-4 py-2.5">
          <span className="text-sm font-medium text-brand">
            {selected.size} selected
          </span>
          <div className="flex flex-wrap gap-2 ml-2">
            {BULK_STATUSES.map((s) => (
              <button
                key={s.value}
                disabled={isPending}
                onClick={() => bulkAction('set_status', s.value)}
                className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors disabled:opacity-50"
              >
                {s.label}
              </button>
            ))}
            <button
              disabled={isPending}
              onClick={() => bulkAction('mark_paid')}
              className="flex items-center gap-1 rounded-md border border-success/30 bg-success/5 px-2.5 py-1 text-xs font-medium text-success hover:bg-success/10 transition-colors disabled:opacity-50"
            >
              <CheckCheck className="h-3 w-3" />
              Mark paid
            </button>
            {canManage && (
              <button
                disabled={isPending}
                onClick={() => {
                  if (confirm(`Delete ${selected.size} booking(s)? This cannot be undone.`)) {
                    bulkAction('delete')
                  }
                }}
                className="flex items-center gap-1 rounded-md border border-danger/30 bg-danger/5 px-2.5 py-1 text-xs font-medium text-danger hover:bg-danger/10 transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </button>
            )}
          </div>
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-text-tertiary" />}
          {error && <span className="text-xs text-danger">{error}</span>}
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-text-tertiary hover:text-text-primary"
          >
            Clear
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="w-10 px-3 py-3">
                <button onClick={toggleAll} className="text-text-tertiary hover:text-text-primary">
                  {allSelected
                    ? <CheckSquare className="h-4 w-4 text-brand" />
                    : <Square className="h-4 w-4" />}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Ref</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Occupant</th>
              <th className="hidden px-4 py-3 text-left text-xs font-medium text-text-tertiary sm:table-cell">Room</th>
              <th className="hidden px-4 py-3 text-left text-xs font-medium text-text-tertiary md:table-cell">Check in</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Status</th>
              <th className="hidden px-4 py-3 text-right text-xs font-medium text-text-tertiary lg:table-cell">Amount</th>
              {canManage && <th className="w-20 px-2 py-3"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {bookings.map((b) => {
              const isSelected = selected.has(b.id)
              return (
                <tr
                  key={b.id}
                  className={`hover:bg-surface-raised transition-colors ${isSelected ? 'bg-brand/5' : ''}`}
                >
                  <td className="px-3 py-3">
                    <button onClick={() => toggle(b.id)} className="text-text-tertiary hover:text-brand">
                      {isSelected
                        ? <CheckSquare className="h-4 w-4 text-brand" />
                        : <Square className="h-4 w-4" />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/bookings/${b.id}`} className="text-xs text-brand hover:text-brand-hover transition-colors">
                      {b.booking_ref}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/bookings/${b.id}`} className="block">
                      <p className="text-sm font-medium text-text-primary">
                        {b.occupant?.first_name} {b.occupant?.last_name}
                      </p>
                      {b.occupant?.phone && (
                        <p className="text-xs text-text-tertiary">{b.occupant.phone}</p>
                      )}
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <p className="text-sm text-text-secondary">
                      {b.room ? `Room ${b.room.room_number}` : '—'}
                    </p>
                    {b.room?.category && (
                      <p className="text-xs text-text-tertiary">{b.room.category.name}</p>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell text-sm text-text-secondary">
                    {formatDate(b.check_in_date)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                        STATUS_STYLES[b.status] ?? 'bg-surface-sunken text-text-secondary border-border'
                      }`}
                    >
                      {b.status.replace(/_/g, ' ')}
                    </span>
                    <p className={`mt-0.5 text-[11px] ${PAYMENT_STYLES[b.payment_status] ?? 'text-text-tertiary'}`}>
                      {b.payment_status}
                    </p>
                  </td>
                  <td className="hidden px-4 py-3 text-right lg:table-cell">
                    <p className="text-sm font-medium text-text-primary">{formatGHS(b.final_amount)}</p>
                  </td>
                  {canManage && (
                    <td className="px-2 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/bookings/${b.id}`}
                          title="Edit booking"
                          className="rounded-md p-1 text-text-tertiary hover:bg-surface-raised hover:text-brand transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          onClick={() => deleteSingle(b.id)}
                          disabled={deletingId === b.id}
                          title="Delete booking"
                          className="rounded-md p-1 text-text-tertiary hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
