import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export async function RecentBookings() {
  // TODO: fetch from Supabase — last 5 bookings for this tenant

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Bookings</CardTitle>
      </CardHeader>
      <CardContent className="pt-3">
        <div className="flex h-48 flex-col items-center justify-center gap-2">
          <p className="text-sm text-text-tertiary">No bookings yet</p>
          <p className="text-xs text-text-disabled">
            Bookings will appear here once created
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
