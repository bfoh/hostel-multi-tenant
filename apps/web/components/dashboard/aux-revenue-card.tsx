import { Store } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatGHS } from '@/lib/utils'
import { getAuxiliaryRevenueSummary } from '@/lib/data/revenue-points'
import { headers } from 'next/headers'

export async function AuxRevenueCard() {
  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')

  let summary = { thisMonth: 0, change: 0 }
  if (tenantId) {
    try {
      summary = await getAuxiliaryRevenueSummary(tenantId)
    } catch {
      // Silently handle — table may not exist yet
    }
  }

  const up = summary.change >= 0

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-text-secondary">Auxiliary Revenue</p>
            <p className="mt-1 currency-amount font-display text-3xl font-bold text-text-primary">
              {formatGHS(summary.thisMonth)}
            </p>
            {summary.thisMonth > 0 && summary.change !== 0 ? (
              <p className={`mt-1 text-xs ${up ? 'text-success' : 'text-danger'}`}>
                {up ? '↑' : '↓'} {Math.abs(summary.change).toFixed(1)}% vs last month
              </p>
            ) : (
              <p className="mt-1 text-xs text-text-tertiary">Gym, cafeteria, laundry, etc.</p>
            )}
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10">
            <Store className="h-5 w-5 text-brand" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
