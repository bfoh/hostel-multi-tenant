'use client'

import Link from 'next/link'

import { useBulkSelect, BulkActionBar } from '@/components/ui/bulk-select'

export interface LfRow {
  id:             string
  description:    string
  category:       string
  found_date:     string
  found_location: string | null
  status:         string
  occupantName:   string | null
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  unclaimed: { label: 'Unclaimed', cls: 'bg-warning/10 text-warning' },
  claimed:   { label: 'Claimed',   cls: 'bg-success/10 text-success' },
  disposed:  { label: 'Disposed',  cls: 'bg-surface-raised text-text-tertiary' },
  donated:   { label: 'Donated',   cls: 'bg-brand/10 text-brand' },
}

export function LostFoundTable({ items }: { items: LfRow[] }) {
  const bulk = useBulkSelect(items.map((i) => i.id))

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <BulkActionBar bulk={bulk} resource="lost_found" itemNoun="item" />
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-raised">
            <tr>
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
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Item</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary hidden sm:table-cell">Category</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Found</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary hidden md:table-cell">Location</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item) => {
              const badge = STATUS_BADGE[item.status] ?? { label: item.status, cls: 'bg-surface-raised text-text-tertiary' }
              return (
                <tr key={item.id} className="hover:bg-surface-raised transition-colors">
                  {bulk.selectMode && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={bulk.isSelected(item.id)}
                        onChange={() => bulk.toggle(item.id)}
                        className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <p className="font-medium text-text-primary line-clamp-2">{item.description}</p>
                    {item.occupantName && (
                      <p className="text-xs text-text-tertiary">{item.occupantName}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-secondary hidden sm:table-cell capitalize">{item.category}</td>
                  <td className="px-4 py-3 text-text-secondary">{item.found_date}</td>
                  <td className="px-4 py-3 text-text-secondary hidden md:table-cell text-xs">{item.found_location ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/lost-found/${item.id}`} className="text-xs text-brand hover:underline">View</Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
