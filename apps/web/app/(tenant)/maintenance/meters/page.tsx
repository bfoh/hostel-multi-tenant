import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { MeterReadingsClient } from '@/components/maintenance/meter-readings-client'

export const metadata: Metadata = { title: 'Meter Readings' }

export default async function MeterReadingsPage() {
  const supabase = createAdminClient()

  const { data: rooms } = await supabase
    .from('rooms')
    .select('id, room_number, block, room_categories(name)')
    .eq('is_active' as any, true)
    .order('room_number')

  const { data: readings } = await supabase
    .from('meter_readings')
    .select('*, rooms(room_number, block)')
    .order('reading_date', { ascending: false })
    .limit(100)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Meter Readings</h1>
          <p className="mt-0.5 text-sm text-text-secondary">Track electricity, water, and gas usage per room</p>
        </div>
      </div>
      <MeterReadingsClient rooms={(rooms ?? []) as any} initialReadings={(readings ?? []) as any} />
    </div>
  )
}
