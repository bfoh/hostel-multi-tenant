import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export async function OccupancyChart() {
  // TODO: fetch 30-day occupancy series from Supabase
  // Placeholder — replace with a Recharts AreaChart once data is wired

  return (
    <Card>
      <CardHeader>
        <CardTitle>Occupancy (30 days)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex h-48 items-center justify-center rounded-lg bg-surface-sunken">
          <p className="text-sm text-text-tertiary">Chart coming soon</p>
        </div>
      </CardContent>
    </Card>
  )
}
