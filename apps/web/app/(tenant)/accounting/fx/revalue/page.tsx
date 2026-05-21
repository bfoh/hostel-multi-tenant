import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'

import { getFxRevaluationPreview } from '@/lib/data/fx-revaluation'
import { formatGHS } from '@/lib/utils'
import { FxRevalRunButton } from '@/components/accounting/fx-revaluation-client'

export const metadata: Metadata = { title: 'FX Revaluation' }

export default async function FxRevaluationPage({
  searchParams,
}: {
  searchParams: Promise<{ asOf?: string }>
}) {
  const sp = await searchParams
  const today = new Date().toISOString().slice(0, 10)
  const asOf = sp.asOf ?? today

  const preview = await getFxRevaluationPreview(asOf)

  if (!preview) {
    return (
      <div className="rounded-xl border border-border bg-surface p-12 text-center">
        <p className="text-sm text-text-secondary">No tenant context.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/accounting/fx"
          className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to FX Rates
        </Link>
        <h1 className="mt-3 text-xl font-semibold text-text-primary">FX Revaluation</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Restates open foreign-currency supplier bills to the latest rate, posts the unrealized gain/loss
        </p>
      </div>

      {/* As-of + run controls */}
      <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-[10px] font-medium text-text-tertiary mb-1 uppercase tracking-widest">As of</label>
              <form method="GET" className="flex items-center gap-2">
                <input
                  type="date"
                  name="asOf"
                  defaultValue={asOf}
                  max={today}
                  className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity"
                >
                  Update
                </button>
              </form>
            </div>
          </div>
          <FxRevalRunButton
            asOf={asOf}
            alreadyPosted={preview.alreadyPosted}
            missingRates={preview.missingRates}
            hasRows={preview.rows.length > 0}
            netAdjustment={preview.netAdjustment}
          />
        </div>

        {preview.alreadyPosted && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300 inline-flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            A revaluation has already been posted for this date.
          </div>
        )}
        {preview.missingRates.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300 inline-flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            Missing FX rate for: {preview.missingRates.join(', ')} — capture rates under FX Rates first.
          </div>
        )}
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi label="Unrealized loss"
             value={formatGHS(preview.totalLoss)}
             sublabel="DR 5300 / CR 2010"
             tone="danger"
             icon={TrendingDown} />
        <Kpi label="Unrealized gain"
             value={formatGHS(preview.totalGain)}
             sublabel="DR 2010 / CR 4040"
             tone="success"
             icon={TrendingUp} />
        <Kpi label="Net adjustment"
             value={`${preview.netAdjustment >= 0 ? '+' : '−'}${formatGHS(Math.abs(preview.netAdjustment))}`}
             sublabel={preview.netAdjustment >= 0 ? 'Favorable (gain outweighs loss)' : 'Unfavorable (loss outweighs gain)'}
             tone={preview.netAdjustment >= 0 ? 'success' : 'danger'} />
      </div>

      {/* Per-bill table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        {preview.rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-text-tertiary">
            No open foreign-currency bills to revalue.
          </p>
        ) : (
          <table className="w-full min-w-[1000px]">
            <thead className="bg-surface-raised">
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text-tertiary">Vendor</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-text-tertiary w-16">Ccy</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-tertiary w-28">Foreign open</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-tertiary w-24">Capture rate</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-tertiary w-24">Current rate</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-tertiary w-32">Book GHS</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-tertiary w-32">Restated GHS</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-text-tertiary w-28">Δ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {preview.rows.map((r) => {
                const tone = r.delta === 0
                  ? 'text-text-tertiary'
                  : r.delta > 0
                  ? 'text-danger'
                  : 'text-success'
                return (
                  <tr key={r.bill_id} className="hover:bg-surface-raised/50 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link href={`/accounting/ap/${r.bill_id}`} className="text-sm text-text-primary hover:text-brand transition-colors">
                        {r.vendor_name}
                      </Link>
                      <p className="mt-0.5 text-[11px] text-text-tertiary truncate max-w-xs">{r.description}</p>
                    </td>
                    <td className="px-4 py-2.5 text-sm font-semibold text-text-primary">{r.currency_code}</td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums text-text-primary">
                      {(r.foreignOutstanding / 100).toLocaleString('en-GH', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs tabular-nums text-text-secondary">{r.capture_rate.toFixed(4)}</td>
                    <td className="px-4 py-2.5 text-right text-xs tabular-nums text-text-secondary">
                      {r.current_rate.toFixed(4)}
                      <p className="text-[10px] text-text-tertiary">{r.rate_as_of}</p>
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums currency-amount text-text-secondary">{formatGHS(r.ghsBalance)}</td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums currency-amount text-text-primary">{formatGHS(r.restatedBalance)}</td>
                    <td className={`px-4 py-2.5 text-right text-sm font-semibold tabular-nums currency-amount ${tone}`}>
                      {r.delta === 0 ? '—' : `${r.delta > 0 ? '+' : '−'}${formatGHS(Math.abs(r.delta))}`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-surface-raised">
                <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-text-primary">Totals</td>
                <td className="px-4 py-3 text-right text-sm font-semibold currency-amount text-text-secondary">
                  {formatGHS(preview.rows.reduce((s, r) => s + r.ghsBalance, 0))}
                </td>
                <td className="px-4 py-3 text-right text-sm font-semibold currency-amount text-text-primary">
                  {formatGHS(preview.rows.reduce((s, r) => s + r.restatedBalance, 0))}
                </td>
                <td className={`px-4 py-3 text-right text-sm font-bold currency-amount ${preview.netAdjustment >= 0 ? 'text-success' : 'text-danger'}`}>
                  {preview.netAdjustment >= 0 ? '+' : '−'}{formatGHS(Math.abs(preview.netAdjustment))}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface-raised px-5 py-3 text-xs text-text-secondary">
        How it works: each bill's outstanding amount is split back into the original currency using the capture-time ratio,
        then re-priced at the latest available rate up to the as-of date. The delta between book GHS and restated GHS is
        posted to 4040 Unrealized FX Gain or 5300 Unrealized FX Loss with the offset against 2010 Accounts Payable.
      </div>
    </div>
  )
}

function Kpi({
  label, value, sublabel, tone, icon: Icon,
}: {
  label: string
  value: string
  sublabel?: string
  tone:  'success' | 'danger'
  icon?: React.ElementType
}) {
  const color = tone === 'success' ? 'text-success' : 'text-danger'
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-secondary">{label}</p>
        {Icon && <Icon className={`h-3.5 w-3.5 ${color}`} />}
      </div>
      <p className={`mt-2 text-xl font-bold currency-amount ${color}`}>{value}</p>
      {sublabel && <p className="mt-1 text-[11px] text-text-tertiary">{sublabel}</p>}
    </div>
  )
}
