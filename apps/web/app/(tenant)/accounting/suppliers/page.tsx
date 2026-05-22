import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'

import { getSuppliers } from '@/lib/data/suppliers'
import { formatGHS } from '@/lib/utils'
import { ExportCsvButton } from '@/components/accounting/export-csv-button'
import { SuppliersTable } from '@/components/accounting/suppliers-table'

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

      <SuppliersTable suppliers={suppliers} />
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
