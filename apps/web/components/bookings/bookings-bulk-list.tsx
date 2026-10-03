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
  group_id?: string | null
  occupant: { first_name: string; last_name: string; phone?: string } | null
  room: { room_number: string; category?: { name: string } | null } | null
}

const STATUS_STYLES: Record<string, string> = {
  pending_payment: 'bg-warning-subtle text-warning-fg border-warning/20',
  confirmed: 'bg-brand-subtle text-brand border-brand/20',
  checked_in: 'bg-success-subtle text-success border-success/20',
  checked_out: 'bg-surface-sunken text-text-secondary border-border',
  cancelled: 'bg-danger-subtle text-danger border-danger/20',
  no_show: 'bg-danger-subtle text-danger border-danger/20',
  enquiry: 'bg-info-subtle text-info border-info/20',
}

const PAYMENT_STYLES: Record<string, string> = {
  unpaid: 'text-danger',
  partial: 'text-warning',
  paid: 'text-success',
  refunded: 'text-info',
}

const BULK_STATUSES = [
  { value: 'confirmed', label: 'Confirm' },
  { value: 'checked_in', label: 'Check In' },
  { value: 'checked_out', label: 'Check Out' },
]

export function BookingsBulkList({
  bookings,
  canManage = false,
  canUpdate = false,
}: {
  bookings: Booking[]
  canManage?: boolean
  canUpdate?: boolean
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showBulkCancel, setShowBulkCancel] = useState(false)
  const [bulkCancelReason, setBulkCancelReason] = useState('')

  const allSelected = bookings.length > 0 && selected.size === bookings.length
  const selectedBookings = bookings.filter((b) => selected.has(b.id))
  const canDeleteSelected =
    selectedBookings.length > 0 && selectedBookings.every((b) => b.status === 'cancelled')

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

  async function bulkAction(action: string, value?: string, reason?: string) {
    setError(null)
    const ids = Array.from(selected)
    if (ids.length === 0) return

    try {
      const res = await fetch('/api/bookings/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action, value, reason }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Bulk action failed')
        return
      }
      if (data.failed?.length) {
        setError(`${data.affected} cancelled; ${data.failed.length} could not be cancelled.`)
      }
      setSelected(new Set())
      setShowBulkCancel(false)
      setBulkCancelReason('')
      startTransition(() => router.refresh())
    } catch {
      setError('Network error')
    }
  }

  return (
    <div>
      {/* Bulk toolbar */}
      {selected.size > 0 && (
        <div className="border-brand/30 bg-brand/5 mb-3 flex flex-wrap items-center gap-2 rounded-lg border px-4 py-2.5">
          <span className="text-brand text-sm font-medium">{selected.size} selected</span>
          <div className="ml-2 flex flex-wrap gap-2">
            {canUpdate &&
              BULK_STATUSES.map((s) => (
                <button
                  key={s.value}
                  disabled={isPending}
                  onClick={() => bulkAction('set_status', s.value)}
                  className="border-border bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-raised rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50"
                >
                  {s.label}
                </button>
              ))}
            {canUpdate && (
              <button
                disabled={isPending}
                onClick={() => bulkAction('mark_paid')}
                className="border-success/30 bg-success/5 text-success hover:bg-success/10 flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50"
              >
                <CheckCheck className="h-3 w-3" />
                Mark paid
              </button>
            )}
            {canManage && (
              <button
                disabled={isPending}
                onClick={() => setShowBulkCancel(true)}
                className="border-danger/30 bg-danger/5 text-danger hover:bg-danger/10 rounded-md border px-2.5 py-1 text-xs font-medium disabled:opacity-50"
              >
                Cancel
              </button>
            )}
            {canManage && canDeleteSelected && (
              <button
                disabled={isPending}
                onClick={() => {
                  if (
                    confirm(`Delete ${selected.size} cancelled booking(s)? This cannot be undone.`)
                  ) {
                    bulkAction('delete')
                  }
                }}
                className="border-danger/30 bg-danger/5 text-danger hover:bg-danger/10 flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </button>
            )}
            {canManage && selected.size > 0 && !canDeleteSelected && (
              <span
                className="text-text-tertiary text-xs"
                title="Only cancelled bookings can be deleted — cancel these first, or deselect any that aren't cancelled."
              >
                Delete available for cancelled bookings only
              </span>
            )}
          </div>
          {isPending && <Loader2 className="text-text-tertiary h-3.5 w-3.5 animate-spin" />}
          {error && <span className="text-danger text-xs">{error}</span>}
          <button
            onClick={() => setSelected(new Set())}
            className="text-text-tertiary hover:text-text-primary ml-auto text-xs"
          >
            Clear
          </button>
        </div>
      )}

      {showBulkCancel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-cancel-title"
            className="border-border bg-surface w-full max-w-md rounded-xl border p-5 shadow-xl"
          >
            <h2 id="bulk-cancel-title" className="text-text-primary text-lg font-semibold">
              Cancel {selected.size} booking{selected.size === 1 ? '' : 's'}
            </h2>
            <p className="text-text-secondary mt-1 text-sm">
              Only pending or confirmed bookings can be cancelled. One reason will be recorded on
              every selected booking.
            </p>
            <label
              htmlFor="bulk-cancellation-reason"
              className="text-text-primary mt-4 block text-sm font-medium"
            >
              Cancellation reason
            </label>
            <textarea
              id="bulk-cancellation-reason"
              value={bulkCancelReason}
              onChange={(event) => setBulkCancelReason(event.target.value)}
              maxLength={500}
              rows={4}
              autoFocus
              className="border-border bg-surface text-text-primary focus:border-brand focus:ring-brand/20 mt-1.5 w-full resize-none rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBulkCancel(false)}
                disabled={isPending}
                className="border-border text-text-secondary hover:bg-surface-raised rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-50"
              >
                Keep bookings
              </button>
              <button
                type="button"
                onClick={() => bulkAction('cancel', undefined, bulkCancelReason.trim())}
                disabled={isPending || bulkCancelReason.trim().length < 3}
                className="bg-danger rounded-md px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Confirm cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile: card list ──────────────────────────────────── */}
      <ul className="space-y-2.5 md:hidden">
        {bookings.map((b) => {
          const isSelected = selected.has(b.id)
          return (
            <li
              key={b.id}
              className={`bg-surface rounded-xl border p-3.5 transition-colors ${isSelected ? 'border-brand/40 bg-brand/5' : 'border-border'}`}
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => toggle(b.id)}
                  className="text-text-tertiary hover:text-brand mt-0.5 shrink-0"
                  aria-label="Select booking"
                >
                  {isSelected ? (
                    <CheckSquare className="text-brand h-5 w-5" />
                  ) : (
                    <Square className="h-5 w-5" />
                  )}
                </button>
                <Link href={`/bookings/${b.id}`} className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-text-primary truncate text-sm font-semibold">
                      {b.occupant?.first_name} {b.occupant?.last_name}
                    </p>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                        STATUS_STYLES[b.status] ??
                        'bg-surface-sunken text-text-secondary border-border'
                      }`}
                    >
                      {b.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="ref-number text-text-tertiary mt-0.5 text-[11px]">
                    {b.booking_ref}
                    {b.group_id && (
                      <span className="border-brand/20 bg-brand-subtle text-brand ml-1.5 inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold">
                        GROUP
                      </span>
                    )}
                  </p>
                  <div className="text-text-secondary mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {b.room && <span>Room {b.room.room_number}</span>}
                    <span>{formatDate(b.check_in_date)}</span>
                    <span className={PAYMENT_STYLES[b.payment_status] ?? 'text-text-tertiary'}>
                      {b.payment_status}
                    </span>
                    <span className="text-text-primary ml-auto font-semibold">
                      {formatGHS(b.final_amount)}
                    </span>
                  </div>
                </Link>
              </div>
              {canManage && (
                <div className="border-border mt-3 flex items-center justify-end gap-1 border-t pt-2.5">
                  <Link
                    href={`/bookings/${b.id}`}
                    aria-label="Edit booking"
                    className="text-text-secondary hover:text-brand hover:bg-brand/10 flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
                  {b.status === 'cancelled' && (
                    <button
                      onClick={() => deleteSingle(b.id)}
                      disabled={deletingId === b.id}
                      aria-label="Delete booking"
                      className="text-text-secondary hover:text-danger hover:bg-danger/10 flex h-9 w-9 items-center justify-center rounded-lg transition-colors disabled:opacity-50"
                    >
                      {deletingId === b.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {/* ── Desktop: table ─────────────────────────────────────── */}
      <div className="border-border bg-surface hidden overflow-x-auto rounded-xl border md:block">
        <table className="w-full">
          <thead>
            <tr className="border-border border-b">
              <th className="w-10 px-3 py-3">
                <button onClick={toggleAll} className="text-text-tertiary hover:text-text-primary">
                  {allSelected ? (
                    <CheckSquare className="text-brand h-4 w-4" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </button>
              </th>
              <th className="text-text-tertiary px-4 py-3 text-left text-xs font-medium">Ref</th>
              <th className="text-text-tertiary px-4 py-3 text-left text-xs font-medium">
                Occupant
              </th>
              <th className="text-text-tertiary hidden px-4 py-3 text-left text-xs font-medium sm:table-cell">
                Room
              </th>
              <th className="text-text-tertiary hidden px-4 py-3 text-left text-xs font-medium md:table-cell">
                Check in
              </th>
              <th className="text-text-tertiary px-4 py-3 text-left text-xs font-medium">Status</th>
              <th className="text-text-tertiary hidden px-4 py-3 text-right text-xs font-medium lg:table-cell">
                Amount
              </th>
              {canManage && <th className="w-20 px-2 py-3"></th>}
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {bookings.map((b) => {
              const isSelected = selected.has(b.id)
              return (
                <tr
                  key={b.id}
                  className={`hover:bg-surface-raised transition-colors ${isSelected ? 'bg-brand/5' : ''}`}
                >
                  <td className="px-3 py-3">
                    <button
                      onClick={() => toggle(b.id)}
                      className="text-text-tertiary hover:text-brand"
                    >
                      {isSelected ? (
                        <CheckSquare className="text-brand h-4 w-4" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/bookings/${b.id}`}
                      className="text-brand hover:text-brand-hover text-xs transition-colors"
                    >
                      {b.booking_ref}
                    </Link>
                    {b.group_id && (
                      <Link
                        href={`/bookings/groups/${b.group_id}`}
                        className="border-brand/20 bg-brand-subtle text-brand hover:bg-brand/20 ml-1.5 inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold"
                      >
                        GROUP
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/bookings/${b.id}`} className="block">
                      <p className="text-text-primary text-sm font-medium">
                        {b.occupant?.first_name} {b.occupant?.last_name}
                      </p>
                      {b.occupant?.phone && (
                        <p className="text-text-tertiary text-xs">{b.occupant.phone}</p>
                      )}
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <p className="text-text-secondary text-sm">
                      {b.room ? `Room ${b.room.room_number}` : '—'}
                    </p>
                    {b.room?.category && (
                      <p className="text-text-tertiary text-xs">{b.room.category.name}</p>
                    )}
                  </td>
                  <td className="text-text-secondary hidden px-4 py-3 text-sm md:table-cell">
                    {formatDate(b.check_in_date)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                        STATUS_STYLES[b.status] ??
                        'bg-surface-sunken text-text-secondary border-border'
                      }`}
                    >
                      {b.status.replace(/_/g, ' ')}
                    </span>
                    <p
                      className={`mt-0.5 text-[11px] ${PAYMENT_STYLES[b.payment_status] ?? 'text-text-tertiary'}`}
                    >
                      {b.payment_status}
                    </p>
                  </td>
                  <td className="hidden px-4 py-3 text-right lg:table-cell">
                    <p className="text-text-primary text-sm font-medium">
                      {formatGHS(b.final_amount)}
                    </p>
                  </td>
                  {canManage && (
                    <td className="px-2 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/bookings/${b.id}`}
                          title="Edit booking"
                          className="text-text-tertiary hover:bg-surface-raised hover:text-brand rounded-md p-1 transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                        {b.status === 'cancelled' && (
                          <button
                            onClick={() => deleteSingle(b.id)}
                            disabled={deletingId === b.id}
                            title="Delete booking"
                            className="text-text-tertiary rounded-md p-1 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
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
