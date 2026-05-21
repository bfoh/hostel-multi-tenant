import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, ArrowRight, Phone, Mail } from 'lucide-react'

import { getSuppliers } from '@/lib/data/suppliers'
import { formatGHS } from '@/lib/utils'
import { ExportCsvButton } from '@/components/accounting/export-csv-button'

export const metadata: Metadata = { title: 'Suppliers' }

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ inactive?: string }>
}) {
  const { inactive } = await searchParams
  const showInactive = inactive === '1'
  const suppliers = await getSuppliers(showInactive)

  const totalOpen = suppliers.reduce((s, v) => s + (v.openBalance ?? 0), 0)
  const totalBills = suppliers.reduce((s, v) => s + (v.openCount ?? 0), 0)

  const csvRows = suppliers.map((s) => [
    s.name, s.contact_name ?? '', s.phone ?? '', s.email ?? '',
    s.tin ?? '', s.payment_terms_days, s.default_currency,
    ((s.openBalance ?? 0) / 100).toFixed(2),
    s.is_active ? 'active' : 'inactive',
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Suppliers</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Vendor master · captures TIN, payment terms, default expense account &amp; currency
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportCsvButton
            filename="suppliers"
            headers={['Name', 'Contact', 'Phone', 'Email', 'TIN', 'Terms (days)', 'Currency', 'Open balance (GHS)', 'Status']}
            rows={csvRows}
          />
          <Link
            href="/accounting/suppliers/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            New supplier
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi label="Total suppliers"    value={suppliers.length.toString()} sublabel={showInactive ? 'incl. inactive' : 'active only'} />
        <Kpi label="Open bills"         value={totalBills.toString()}       sublabel="across all suppliers" />
        <Kpi label="Total payable"      value={formatGHS(totalOpen)}        tone="brand" />
      </div>

      <div className="flex items-center gap-2">
        <Link
          href="/accounting/suppliers"
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            !showInactive ? 'bg-brand text-white' : 'border border-border bg-surface text-text-secondary hover:text-text-primary'
          }`}
        >
          Active
        </Link>
        <Link
          href="/accounting/suppliers?inactive=1"
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            showInactive ? 'bg-brand text-white' : 'border border-border bg-surface text-text-secondary hover:text-text-primary'
          }`}
        >
          Include inactive
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        {suppliers.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-text-tertiary">No suppliers yet.</p>
        ) : (
          <table className="w-full min-w-[900px]">
            <thead className="bg-surface-raised">
              <tr className="border-b border-border">
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

function Kpi({ label, value, sublabel, tone }: { label: string; value: string; sublabel?: string; tone?: 'brand' }) {
  const color = tone === 'brand' ? 'text-brand' : 'text-text-primary'
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className={`mt-2 text-xl font-bold currency-amount ${color}`}>{value}</p>
      {sublabel && <p className="mt-1 text-[11px] text-text-tertiary">{sublabel}</p>}
    </div>
  )
}
