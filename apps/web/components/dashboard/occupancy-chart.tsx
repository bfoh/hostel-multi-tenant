import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { OccupancyAreaChart } from '@/components/dashboard/occupancy-area-chart'
import { getOccupancyTrend } from '@/lib/data/dashboard'

export async function OccupancyChart() {
  const trend = await getOccupancyTrend()

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Occupancy Trend (7 days)</CardTitle>
      </CardHeader>
      <CardContent>
        {trend.length === 0 ? (
          <div className="flex h-48 items-center justify-center rounded-lg bg-surface-sunken">
            <p className="text-sm text-text-tertiary">No data yet</p>
          </div>
        ) : (
          <OccupancyAreaChart data={trend} />
        )}
      </CardContent>
    </Card>
  )
}
