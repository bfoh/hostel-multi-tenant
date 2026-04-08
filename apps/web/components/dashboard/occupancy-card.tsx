import { BedDouble } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

export async function OccupancyCard() {
  // TODO: fetch real occupancy data from Supabase
  // const supabase = await createClient()
  // const { data } = await supabase.rpc('get_occupancy_summary')

  const occupied = 0
  const total = 0
  const pct = total > 0 ? Math.round((occupied / total) * 100) : 0

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-text-secondary">Occupancy</p>
            <p className="mt-1 font-display text-3xl font-bold text-text-primary tabular-nums">
              {pct}%
            </p>
            <p className="mt-1 text-xs text-text-tertiary">
              {occupied} / {total} rooms
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-subtle">
            <BedDouble className="h-5 w-5 text-brand" />
          </div>
        </div>
        {/* Occupancy bar */}
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
          <div
            className="occupancy-bar-fill h-full rounded-full bg-brand"
            style={{ width: `${pct}%` }}
          />
        </div>
      </CardContent>
    </Card>
  )
}
