'use client'

import Link from 'next/link'
import { Phone, Mail, ArrowRight } from 'lucide-react'

import { formatGHS } from '@/lib/utils'
import { useBulkSelect, BulkActionBar } from '@/components/ui/bulk-select'
import type { Supplier } from '@/lib/data/suppliers'

export function SuppliersTable({ suppliers }: { suppliers: Supplier[] }) {
  const bulk = useBulkSelect(suppliers.map((s) => s.id))

  return (
    <div className="space-y-3">
      {suppliers.length > 0 && (
        <div className="flex justify-end">
          <BulkActionBar bulk={bulk} resource="suppliers" itemNoun="supplier" />
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        {suppliers.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-text-tertiary">No suppliers yet.</p>
        ) : (
          <table className="w-full min-w-[900px]">
            <thead className="bg-surface-raised">
              <tr className="border-b border-border">
                {bulk.selectMode && (
                  <th className="px-4 py-2.5 w-8">
                    <input
                      type="checkbox"
                      checked={bulk.allSelected}
                      onChange={bulk.toggleAll}
                      className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
                      aria-label="Select all"
                    />
                  </th>
                )}
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text-tertiary">Supplier</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text-tertiary w-48">Contact</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text-tertiary w-32">TIN</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-tertiary w-24">Terms</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-tertiary w-32">Open balance</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-tertiary w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {suppliers.map((s) => (
                <tr key={s.id} className="hover:bg-surface-raised/50 transition-colors">
                  {bulk.selectMode && (
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={bulk.isSelected(s.id)}
                        onChange={() => bulk.toggle(s.id)}
                        className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
                      />
                    </td>
                  )}
                  <td className="px-4 py-2.5">
                    <Link href={`/accounting/suppliers/${s.id}`} className="text-sm font-medium text-text-primary hover:text-brand transition-colors">
                      {s.name}
                    </Link>
                    {!s.is_active && (
                      <span className="ml-2 inline-block rounded-full bg-surface-raised px-1.5 py-0 text-[10px] text-text-tertiary">inactive</span>
                    )}
                    {s.default_currency !== 'GHS' && (
                      <span className="ml-2 inline-block rounded-full bg-brand/10 px-1.5 py-0 text-[10px] font-semibold text-brand">{s.default_currency}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-text-secondary">
                    <div className="flex flex-wrap gap-2">
                      {s.phone && <a href={`tel:${s.phone}`} className="inline-flex items-center gap-1 hover:text-brand transition-colors"><Phone className="h-3 w-3" />{s.phone}</a>}
                      {s.email && <a href={`mailto:${s.email}`} className="inline-flex items-center gap-1 hover:text-brand transition-colors"><Mail className="h-3 w-3" />{s.email}</a>}
                    </div>
                    {s.contact_name && <p className="mt-0.5 text-text-tertiary">{s.contact_name}</p>}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-mono text-text-secondary">{s.tin ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right text-xs tabular-nums text-text-secondary">{s.payment_terms_days}d</td>
                  <td className="px-4 py-2.5 text-right">
                    {(s.openBalance ?? 0) > 0 ? (
                      <>
                        <p className="text-sm font-semibold currency-amount text-text-primary">{formatGHS(s.openBalance ?? 0)}</p>
                        <p className="mt-0.5 text-[10px] text-text-tertiary">{s.openCount} bill{s.openCount === 1 ? '' : 's'}</p>
                      </>
                    ) : (
                      <span className="text-xs text-text-tertiary">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link href={`/accounting/suppliers/${s.id}`} className="inline-flex items-center gap-0.5 text-xs text-brand hover:opacity-80 transition-opacity">
                      Open <ArrowRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
