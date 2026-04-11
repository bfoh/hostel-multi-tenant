import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PmScheduleForm } from '@/components/maintenance/pm-schedule-form'

export const metadata: Metadata = { title: 'New PM Schedule' }

export default async function NewPmSchedulePage() {
  const supabase = await createClient()
  const [{ data: rooms }, { data: contractors }] = await Promise.all([
    supabase.from('rooms').select('id, room_number, block').order('room_number'),
    supabase.from('contractors').select('id, name').eq('is_active', true).order('name'),
  ])

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/maintenance/schedules" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft className="h-4 w-4" /> PM Schedules
        </Link>
        <span className="text-text-disabled">/</span>
        <span className="text-sm font-medium text-text-primary">New schedule</span>
      </div>
      <div>
        <h1 className="text-xl font-semibold text-text-primary">New PM Schedule</h1>
        <p className="mt-1 text-sm text-text-secondary">Define a recurring task — work orders will be generated automatically on each due date.</p>
      </div>
      <PmScheduleForm rooms={rooms ?? []} contractors={contractors ?? []} />
    </div>
  )
}
