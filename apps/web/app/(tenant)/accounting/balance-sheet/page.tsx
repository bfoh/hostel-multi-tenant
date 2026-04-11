import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

import { getBalanceSheet } from '@/lib/data/accounting'
import { formatGHS } from '@/lib/utils'

export const metadata: Metadata = { title: 'Balance Sheet' }

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ asOf?: string }>
}) {
  const { asOf: asOfParam } = await searchParams
  const asOf = asOfParam ?? new Date().toISOString().slice(0, 10)

  const bs = await getBalanceSheet(asOf)

  const balanced = Math.abs(bs.totalAssets - (bs.totalLiabilities + bs.totalEquity)) <= 1

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link href="/accounting" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft className="h-4 w-4" /> Accounting
        </Link>
        <span className="text-text-disabled">/</span>
        <span className="text-sm font-medium text-text-primary">Balance Sheet</span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Balance Sheet</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Financial position as at{' '}
            <strong>{new Date(asOf).toLocaleDateString('en-GH', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
          </p>
        </div>

        {/* Date picker */}
        <form method="GET" className="flex items-center gap-2">
          <label className="text-xs text-text-secondary">As at</label>
          <input
            type="date"
            name="asOf"
            defaultValue={asOf}
            max={new Date().toISOString().slice(0, 10)}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text-primary focus:border-brand focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity"
          >
            Update
          </button>
        </form>
      </div>

      {/* Balance check */}
      {!balanced && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          Balance sheet does not balance (Assets ≠ Liabilities + Equity). Check for missing journal entries.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Assets */}
        <Section title="Assets" total={bs.totalAssets} totalLabel="Total Assets" totalColor="text-success">
          {bs.assets.length === 0 ? (
            <EmptyRow />
          ) : (
            bs.assets.map((a) => (
              <AccountRow key={a.account_id} code={a.code} name={a.name} amount={a.balance} />
            ))
          )}
        </Section>

        {/* Liabilities + Equity */}
        <div className="space-y-6">
          <Section title="Liabilities" total={bs.totalLiabilities} totalLabel="Total Liabilities" totalColor="text-danger">
            {bs.liabilities.length === 0 ? (
              <EmptyRow />
            ) : (
              bs.liabilities.map((a) => (
                <AccountRow key={a.account_id} code={a.code} name={a.name} amount={a.balance} />
              ))
            )}
          </Section>

          <Section title="Equity" total={bs.totalEquity} totalLabel="Total Equity" totalColor="text-brand">
            {bs.equity.length === 0 ? (
              <EmptyRow />
            ) : (
              bs.equity.map((a) => (
                <AccountRow key={a.account_id} code={a.code} name={a.name} amount={a.balance} />
              ))
            )}
          </Section>

          {/* Liabilities + Equity total */}
          <div className="rounded-xl border-2 border-border bg-surface px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-text-primary">Liabilities + Equity</span>
            <span className={`font-bold currency-amount ${balanced ? 'text-success' : 'text-danger'}`}>
              {formatGHS(bs.totalLiabilities + bs.totalEquity)}
            </span>
          </div>
        </div>
      </div>

      {/* Fundamental equation */}
      <div className="rounded-xl border border-border bg-surface-raised px-5 py-4 text-xs text-text-secondary">
        <span className="font-mono">Assets ({formatGHS(bs.totalAssets)})</span>
        {' = '}
        <span className="font-mono">Liabilities ({formatGHS(bs.totalLiabilities)})</span>
        {' + '}
        <span className="font-mono">Equity ({formatGHS(bs.totalEquity)})</span>
        {balanced
          ? <span className="ml-2 text-success font-medium">✓ Balanced</span>
          : <span className="ml-2 text-danger font-medium">✗ Out of balance</span>
        }
      </div>
    </div>
  )
}

function Section({
  title,
  total,
  totalLabel,
  totalColor,
  children,
}: {
  title: string
  total: number
  totalLabel: string
  totalColor: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="border-b border-border bg-surface-raised px-4 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-text-secondary">{title}</h2>
      </div>
      <div className="divide-y divide-border/50">{children}</div>
      <div className="border-t border-border bg-surface-raised px-4 py-2.5 flex items-center justify-between">
        <span className="text-xs font-semibold text-text-secondary">{totalLabel}</span>
        <span className={`text-sm font-bold currency-amount ${totalColor}`}>{formatGHS(total)}</span>
      </div>
    </div>
  )
}

function AccountRow({ code, name, amount }: { code: string; name: string; amount: number }) {
  return (
    <div className="flex items-center px-4 py-2.5 text-sm">
      <span className="w-14 shrink-0 font-mono text-xs text-text-tertiary">{code}</span>
      <span className="flex-1 text-text-secondary">{name}</span>
      <span className="font-medium currency-amount text-text-primary">{formatGHS(amount)}</span>
    </div>
  )
}

function EmptyRow() {
  return (
    <div className="px-4 py-3 text-xs text-text-tertiary italic">No entries</div>
  )
}
