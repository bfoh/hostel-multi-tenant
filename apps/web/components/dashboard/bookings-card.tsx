import { CalendarCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { getBookingStats } from '@/lib/data/dashboard'

export async function BookingsCard() {
  const { pending, todayCheckIns, todayCheckOuts } = await getBookingStats()

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-text-secondary">Pending Bookings</p>
            <p className="mt-1 font-display text-3xl font-bold text-text-primary tabular-nums">
              {pending}
            </p>
            <p className="mt-1 text-xs text-text-tertiary">
              {todayCheckIns} check-in{todayCheckIns !== 1 ? 's' : ''} ·{' '}
              {todayCheckOuts} check-out{todayCheckOuts !== 1 ? 's' : ''} today
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
