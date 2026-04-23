import { DollarSign } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatGHS } from '@/lib/utils'
import { getRevenueStats, getRevenueBreakdown } from '@/lib/data/dashboard'

export async function RevenueCard() {
  const [{ thisMonth, change }, breakdown] = await Promise.all([
    getRevenueStats(),
    getRevenueBreakdown(),
  ])
  const up = change >= 0

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-text-secondary">Revenue (Month)</p>
            <p className="mt-1 currency-amount font-display text-3xl font-bold text-text-primary">
              {formatGHS(thisMonth)}
            </p>
            {change !== 0 ? (
              <p className={`mt-1 text-xs ${up ? 'text-success' : 'text-danger'}`}>
                {up ? '↑' : '↓'} {Math.abs(change).toFixed(1)}% vs last month
              </p>
            ) : (
              <p className="mt-1 text-xs text-text-tertiary">No data for last month</p>
            )}
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-subtle">
            <DollarSign className="h-5 w-5 text-success" />
          </div>
        </div>

        {/* Cash vs Digital breakdown */}
        {breakdown.total > 0 && (
          <div className="mt-3 border-t border-border pt-3">
            <div className="flex justify-between text-[11px]">
              <span className="flex items-center gap-1.5 text-text-secondary">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                Cash {formatGHS(breakdown.cash)}
              </span>
              <span className="flex items-center gap-1.5 text-text-secondary">
                <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                Digital {formatGHS(breakdown.digital)}
              </span>
            </div>
            <div className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
              <div
                className="h-full bg-success transition-all"
                style={{ width: `${breakdown.cashPct}%` }}
              />
              <div
                className="h-full bg-brand transition-all"
                style={{ width: `${breakdown.digitalPct}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
