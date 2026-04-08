import { DollarSign } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatGHS } from '@/lib/utils'
import { getRevenueStats } from '@/lib/data/dashboard'

export async function RevenueCard() {
  const { thisMonth, change } = await getRevenueStats()
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
      </CardContent>
    </Card>
  )
}
