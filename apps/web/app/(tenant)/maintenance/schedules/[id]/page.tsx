import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, CalendarClock, Play } from 'lucide-react'
import { getPmScheduleById, FREQUENCY_LABELS } from '@/lib/data/pm-schedules'
import { formatGHS } from '@/lib/utils'
import { RunNowButton } from '@/components/maintenance/run-now-button'
import { PmScheduleForm } from '@/components/maintenance/pm-schedule-form'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'PM Schedule' }

export default async function PmScheduleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [schedule, { data: rooms }, { data: contractors }, { data: workOrders }] = await Promise.all([
    getPmScheduleById(id),
    supabase.from('rooms').select('id, room_number, block').order('room_number'),
    supabase.from('contractors').select('id, name').eq('is_active', true).order('name'),
    supabase.from('maintenance_requests')
      .select('id, ref_number, title, status, created_at')
      .eq('pm_schedule_id' as any, id)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  if (!schedule) notFound()

  const today = new Date().toISOString().slice(0, 10)
  const isOverdue = schedule.status === 'active' && schedule.next_due_date < today

  const initial = {
    id:                    schedule.id,
    title:                 schedule.title,
    description:           schedule.description,
    category:              schedule.category,
    room_id:               schedule.room_id,
    location_note:         schedule.location_note,
    frequency:             schedule.frequency,
    interval_value:        schedule.interval_value,
    start_date:            schedule.start_date,
    next_due_date:         schedule.next_due_date,
    default_priority:      schedule.default_priority,
    default_contractor_id: schedule.default_contractor_id,
    estimated_cost_ghs:    schedule.estimated_cost_ghs,
    status:                schedule.status,
    notes:                 schedule.notes,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/maintenance/schedules" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft className="h-4 w-4" /> PM Schedules
        </Link>
        <span className="text-text-disabled">/</span>
        <span className="text-sm text-text-primary truncate">{schedule.title}</span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">{schedule.title}</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {schedule.interval_value > 1 ? `Every ${schedule.interval_value} ` : ''}{FREQUENCY_LABELS[schedule.frequency]}
            {' · '}Next due:{' '}
            <span className={isOverdue ? 'text-danger font-semibold' : 'text-text-primary'}>
              {schedule.next_due_date}{isOverdue ? ' (overdue)' : ''}
            </span>
          </p>
        </div>
        {schedule.status === 'active' && (
          <RunNowButton scheduleId={id} />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left — edit form */}
        <div className="lg:col-span-2">
          <PmScheduleForm rooms={rooms ?? []} contractors={contractors ?? []} initial={initial} />
        </div>

        {/* Right — history */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold text-text-primary mb-4">Work order history</h2>
            {!workOrders || workOrders.length === 0 ? (
              <p className="text-xs text-text-tertiary">No work orders generated yet.</p>
            ) : (
              <ol className="space-y-2">
                {workOrders.map(wo => (
                  <li key={wo.id}>
                    <Link href={`/maintenance/${wo.id}`} className="block rounded-lg border border-border bg-surface-raised px-3 py-2 hover:bg-surface transition-colors">
                      <p className="text-xs font-mono text-text-tertiary">{wo.ref_number}</p>
                      <p className="text-sm font-medium text-text-primary truncate">{wo.title.replace('[PM] ', '')}</p>
                      <p className="text-xs text-text-secondary capitalize">{wo.status.replace('_', ' ')} · {wo.created_at.slice(0, 10)}</p>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {schedule.last_run_date && (
            <div className="rounded-xl border border-border bg-surface p-5">
              <h2 className="text-sm font-semibold text-text-primary mb-2">Last run</h2>
              <p className="text-sm text-text-secondary">{schedule.last_run_date}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
