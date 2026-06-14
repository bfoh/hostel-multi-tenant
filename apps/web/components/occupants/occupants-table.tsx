'use client'

import Link from 'next/link'
import { Pencil } from 'lucide-react'

import { initials } from '@/lib/utils'
import { useBulkSelect, BulkActionBar } from '@/components/ui/bulk-select'
import { DeleteOccupantButton } from '@/components/occupants/delete-occupant-button'

export interface OccupantRow {
  id:          string
  first_name:  string
  last_name:   string
  photo_url:   string | null
  student_id:  string | null
  phone:       string | null
  institution: string | null
  status:      string
  roomLabel:   string | null
}

const STATUS_STYLES: Record<string, string> = {
  active:    'bg-success-subtle text-success border-success/20',
  pending:   'bg-warning-subtle text-warning-fg border-warning/20',
  checked_out:'bg-surface-sunken text-text-secondary border-border',
  suspended: 'bg-danger-subtle text-danger border-danger/20',
}

export function OccupantsTable({ occupants }: { occupants: OccupantRow[] }) {
  const bulk = useBulkSelect(occupants.map((o) => o.id))

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <BulkActionBar bulk={bulk} resource="occupants" itemNoun="resident" />
      </div>

      {/* ── Mobile: card list ──────────────────────────────────── */}
      <ul className="space-y-2.5 md:hidden">
        {occupants.map((o) => (
          <li key={o.id} className="rounded-xl border border-border bg-surface p-3.5">
            <div className="flex items-center gap-3">
              {bulk.selectMode && (
                <input
                  type="checkbox"
                  checked={bulk.isSelected(o.id)}
                  onChange={() => bulk.toggle(o.id)}
                  className="h-5 w-5 shrink-0 rounded border-border text-brand focus:ring-brand"
                  aria-label={`Select ${o.first_name}`}
                />
              )}
              <Link href={`/occupants/${o.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-sm font-semibold text-brand">
                  {o.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    initials(`${o.first_name} ${o.last_name}`)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text-primary">
                    {o.first_name} {o.last_name}
                  </p>
                  <p className="truncate text-xs text-text-tertiary">
                    {o.student_id ?? o.institution ?? 'No ID'}
                  </p>
                </div>
              </Link>
              <span
                className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${
                  STATUS_STYLES[o.status] ?? 'bg-surface-sunken text-text-secondary border-border'
                }`}
              >
                {o.status.replace('_', ' ')}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
              <div className="min-w-0 text-xs text-text-secondary">
                <span className="ref-number">{o.phone ?? '—'}</span>
                {o.roomLabel && <span className="text-text-tertiary"> · {o.roomLabel}</span>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Link
                  href={`/occupants/${o.id}/edit`}
                  aria-label="Edit occupant"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:text-brand hover:bg-brand/10 transition-colors"
                >
                  <Pencil className="h-4 w-4" />
                </Link>
                <DeleteOccupantButton
                  occupantId={o.id}
                  occupantName={`${o.first_name} ${o.last_name}`}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* ── Desktop: table ─────────────────────────────────────── */}
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-surface md:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {bulk.selectMode && (
                <th className="px-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={bulk.allSelected}
                    onChange={bulk.toggleAll}
                    className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
                    aria-label="Select all"
                  />
                </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Phone</th>
              <th className="hidden px-4 py-3 text-left text-xs font-medium text-text-tertiary sm:table-cell">Institution</th>
              <th className="hidden px-4 py-3 text-left text-xs font-medium text-text-tertiary lg:table-cell">Status</th>
              <th className="hidden px-4 py-3 text-left text-xs font-medium text-text-tertiary xl:table-cell">Room</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-text-tertiary"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {occupants.map((o) => (
              <tr key={o.id} className="hover:bg-surface-raised transition-colors">
                {bulk.selectMode && (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={bulk.isSelected(o.id)}
                      onChange={() => bulk.toggle(o.id)}
                      className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
                    />
                  </td>
                )}
                <td className="px-4 py-3">
                  <Link href={`/occupants/${o.id}`} className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold text-brand">
                      {o.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={o.photo_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        initials(`${o.first_name} ${o.last_name}`)
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text-primary hover:text-brand transition-colors">
                        {o.first_name} {o.last_name}
                      </p>
                      {o.student_id && (
                        <p className="ref-number text-[11px] text-text-tertiary">{o.student_id}</p>
                      )}
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-text-secondary">{o.phone}</td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <p className="truncate text-sm text-text-secondary">{o.institution ?? '—'}</p>
                </td>
                <td className="hidden px-4 py-3 lg:table-cell">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${
                      STATUS_STYLES[o.status] ?? 'bg-surface-sunken text-text-secondary border-border'
                    }`}
                  >
                    {o.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="hidden px-4 py-3 xl:table-cell text-sm text-text-secondary">
                  {o.roomLabel ?? '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/occupants/${o.id}/edit`}
                      title="Edit occupant"
                      className="rounded p-1.5 text-text-disabled hover:text-brand hover:bg-brand/10 transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Link>
                    <DeleteOccupantButton
                      occupantId={o.id}
                      occupantName={`${o.first_name} ${o.last_name}`}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
