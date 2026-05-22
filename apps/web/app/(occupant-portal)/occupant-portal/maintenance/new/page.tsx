import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOccupantSession } from '@/lib/auth/occupant-session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { NewMaintenanceForm } from '@/components/occupant-portal/new-maintenance-form'

export const metadata: Metadata = { title: 'New Request · Maintenance · My Portal' }

export default async function NewMaintenancePage() {
  const session = await getOccupantSession()
  if (!session) redirect('/occupant-portal')

  const { occupantId, tenantId, tenantColor: color } = session
  const admin = createAdminClient()

  const { data: booking } = await admin
    .from('bookings')
    .select('id, booking_ref, rooms(room_number, block)')
    .eq('occupant_id', occupantId)
    .eq('tenant_id', tenantId)
    .in('status', ['checked_in', 'confirmed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!booking) redirect('/occupant-portal/maintenance')

  const room = (Array.isArray(booking.rooms) ? booking.rooms[0] : booking.rooms) as any

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/occupant-portal/maintenance" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors">
          <ChevronLeft className="h-4 w-4" /> Back
        </Link>
      </div>

      <div>
        <h1 className="text-[18px] font-bold tracking-tight text-slate-900">Report an issue</h1>
        {room && (
          <p className="mt-0.5 text-[12px] text-slate-500">
            Room {room.room_number}{room.block ? ` · ${room.block}` : ''}
          </p>
        )}
      </div>

      <NewMaintenanceForm color={color} />
    </div>
  )
}
