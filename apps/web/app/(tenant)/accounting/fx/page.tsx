import type { Metadata } from 'next'
import Link from 'next/link'
import { Banknote, RefreshCw } from 'lucide-react'

import { getFxRates, getLatestFxRates } from '@/lib/data/fx'
import { FxRatesClient } from '@/components/accounting/fx-rates-client'

export const metadata: Metadata = { title: 'FX Rates' }

export default async function FxRatesPage() {
  const [rates, latest] = await Promise.all([getFxRates(), getLatestFxRates()])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">FX Rates</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Capture daily exchange rates against GHS · 1 unit foreign currency = X GHS
          </p>
        </div>
        <Link
          href="/accounting/fx/revalue"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-raised hover:text-text-primary transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Run revaluation
        </Link>
      </div>

      {latest.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {latest.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-brand" />
                  <p className="text-sm font-semibold text-text-primary">{r.currency_code}</p>
                </div>
                <p className="text-[11px] text-text-tertiary">
                  {new Date(r.as_of_date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })}
                </p>
              </div>
              <p className="mt-2 text-xl font-bold currency-amount text-text-primary tabular-nums">
                {r.rate_to_base.toFixed(4)} <span className="text-xs font-medium text-text-tertiary">GHS</span>
              </p>
              {r.source && <p className="mt-1 text-[11px] text-text-tertiary">{r.source}</p>}
            </div>
          ))}
        </div>
      )}

      <FxRatesClient initialRates={rates} />
    </div>
  )
}
