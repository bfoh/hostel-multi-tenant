import { CalendarCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export async function BookingsCard() {
  // TODO: fetch real bookings data
  const pending = 0
  const todayCheckIns = 0
  const todayCheckOuts = 0

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-text-secondary">Bookings</p>
            <p className="mt-1 font-display text-3xl font-bold text-text-primary tabular-nums">
              {pending}
            </p>
            <p className="mt-1 text-xs text-text-tertiary">
              {todayCheckIns} check-ins · {todayCheckOuts} check-outs today
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info-subtle">
            <CalendarCheck className="h-5 w-5 text-info" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
