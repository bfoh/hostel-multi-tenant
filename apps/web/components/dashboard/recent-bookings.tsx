import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getRecentBookings } from '@/lib/data/dashboard'
import { formatGHS, formatDate } from '@/lib/utils'

const STATUS_STYLES: Record<string, string> = {
  pending_payment: 'bg-warning-subtle text-warning-fg border-warning/20',
  confirmed:       'bg-brand-subtle text-brand border-brand/20',
  checked_in:      'bg-success-subtle text-success border-success/20',
  checked_out:     'bg-surface-sunken text-text-secondary border-border',
  cancelled:       'bg-danger-subtle text-danger border-danger/20',
  no_show:         'bg-danger-subtle text-danger border-danger/20',
}

const STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Pending',
  confirmed:       'Confirmed',
  checked_in:      'Checked In',
  checked_out:     'Checked Out',
  cancelled:       'Cancelled',
  no_show:         'No Show',
  enquiry:         'Enquiry',
}

export async function RecentBookings() {
  const bookings = await getRecentBookings(8)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>Recent Bookings</CardTitle>
        <Link
          href="/bookings"
          className="text-xs font-medium text-brand hover:text-brand-hover transition-colors"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent className="pt-0">
        {bookings.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2">
            <p className="text-sm text-text-tertiary">No bookings yet</p>
            <Link
              href="/bookings/new"
              className="text-xs font-medium text-brand hover:text-brand-hover transition-colors"
            >
              Create first booking →
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {bookings.map((b) => {
              const occupant = Array.isArray(b.occupant) ? b.occupant[0] : b.occupant
              const room = Array.isArray(b.room) ? b.room[0] : b.room
              const category = Array.isArray(room?.category) ? room.category[0] : room?.category

              return (
                <li key={b.id}>
                  <Link
                    href={`/bookings/${b.id}`}
                    className="flex items-center gap-3 py-2.5 hover:bg-surface-raised rounded-lg px-1 -mx-1 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {occupant?.first_name} {occupant?.last_name}
                      </p>
                      <p className="truncate text-xs text-text-tertiary">
                        {room?.room_number ? `Room ${room.room_number}` : '—'}
                        {category?.name ? ` · ${category.name}` : ''}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                          STATUS_STYLES[b.status] ?? 'bg-surface-sunken text-text-secondary border-border'
                        }`}
                      >
                        {STATUS_LABELS[b.status] ?? b.status}
                      </span>
                      <p className="mt-0.5 text-xs text-text-tertiary currency-amount">
                        {formatGHS(b.final_amount)}
                      </p>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
