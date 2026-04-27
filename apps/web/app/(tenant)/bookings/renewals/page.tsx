import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { RenewalClient } from '@/components/bookings/renewal-client'

export const metadata: Metadata = { title: 'Lease Renewals' }

export default async function RenewalsPage() {
  const supabase = createAdminClient()
  const today    = new Date().toISOString().slice(0, 10)
  const in30     = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

  const { data: expiring } = await supabase
    .from('bookings')
    .select(`
      id, booking_ref, status, check_in_date, check_out_date,
      rate_per_unit, rate_unit, final_amount, paid_amount,
      occupants(first_name, last_name, phone, email),
      rooms(room_number, block, room_categories(name))
    `)
    .in('status', ['confirmed', 'checked_in'])
    .gte('check_out_date', today)
    .lte('check_out_date', in30)
    .order('check_out_date')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Lease Renewals</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            Bookings expiring within 30 days — {expiring?.length ?? 0} found
          </p>
        </div>
        <Link href="/bookings"
          className="text-sm text-text-secondary hover:text-text-primary transition-colors">
          ← All bookings
        </Link>
      </div>
      <RenewalClient initialBookings={expiring ?? []} />
    </div>
  )
}
