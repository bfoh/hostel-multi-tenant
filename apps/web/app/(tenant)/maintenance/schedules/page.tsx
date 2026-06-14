import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, CalendarClock, AlertCircle, CheckCircle2, PauseCircle } from 'lucide-react'
import { getPmSchedules, getPmStats, FREQUENCY_LABELS } from '@/lib/data/pm-schedules'

export const metadata: Metadata = { title: 'PM Schedules' }

const STATUS_BADGE: Record<string, string> = {
  active:   'bg-success/10 text-success',
  paused:   'bg-warning/10 text-warning',
  archived: 'bg-surface-raised text-text-tertiary',
}

const PRIORITY_BADGE: Record<string, string> = {
  low:    'bg-surface-raised text-text-secondary',
  medium: 'bg-brand/10 text-brand',
  high:   'bg-warning/10 text-warning',
  urgent: 'bg-danger/10 text-danger',
}

export default async function PmSchedulesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status = 'active' } = await searchParams
  const [schedules, stats] = await Promise.all([
    getPmSchedules({ status }),
    getPmStats(),
  ])

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/maintenance" className="text-sm text-text-secondary hover:text-text-primary transition-colors">Maintenance</Link>
            <span className="text-text-disabled">/</span>
            <h1 className="text-xl font-semibold text-text-primary">PM Schedules</h1>
          </div>
          <p className="mt-1 text-sm text-text-secondary">Recurring maintenance tasks that auto-generate work orders.</p>
        </div>
        <Link
          href="/maintenance/schedules/new"
          className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity shrink-0"
        >
          <Plus className="h-4 w-4" /> New schedule
        </Link>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Active',    value: stats.active,   icon: CheckCircle2,  cls: 'text-success' },
          { label: 'Overdue',   value: stats.overdue,  icon: AlertCircle,   cls: 'text-danger' },
          { label: 'Due today', value: stats.dueToday, icon: CalendarClock, cls: 'text-warning' },
          { label: 'Total',     value: stats.total,    icon: CalendarClock, cls: 'text-text-primary' },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="rounded-xl border border-border bg-surface p-4">
              <p className="text-xs text-text-secondary">{s.label}</p>
              <p className={`mt-1.5 text-2xl font-bold ${s.cls}`}>{s.value}</p>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-1 rounded-lg border border-border bg-surface p-1 w-fit">
        {(['active', 'paused', 'archived', 'all'] as const).map(s => (
          <Link
            key={s}
            href={s === 'active' ? '/maintenance/schedules' : `/maintenance/schedules?status=${s}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors capitalize ${
              status === s || (s === 'active' && !searchParams)
                ? 'bg-brand text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised'
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      {/* List */}
      {schedules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-16 text-center">
          <CalendarClock className="mx-auto h-10 w-10 text-text-disabled mb-3" />
          <p className="text-sm font-medium text-text-primary">No schedules found</p>
          <p className="text-xs text-text-secondary mt-1">Create a recurring schedule to automate preventive maintenance.</p>
          <Link href="/maintenance/schedules/new" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            <Plus className="h-4 w-4" /> New schedule
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-raised">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Task</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary hidden sm:table-cell">Frequency</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Next due</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary hidden md:table-cell">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {schedules.map(s => {
                const isOverdue = s.status === 'active' && s.next_due_date < today
                return (
                  <tr key={s.id} className="hover:bg-surface-raised transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-text-primary">{s.title}</p>
                      <p className="text-xs text-text-tertiary capitalize">{s.category.replace('_', ' ')}{s.room ? ` · Room ${s.room.room_number}` : ''}</p>
                    </td>
                    <td className="px-4 py-3 text-text-secondary hidden sm:table-cell">
                      {s.interval_value > 1 ? `Every ${s.interval_value} ` : ''}{FREQUENCY_LABELS[s.frequency]}
                    </td>
                    <td className="px-4 py-3">
                      <span className={isOverdue ? 'text-danger font-semibold' : 'text-text-primary'}>
                        {s.next_due_date}
                      </span>
                      {isOverdue && <span className="ml-1 text-[10px] text-danger">OVERDUE</span>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${PRIORITY_BADGE[s.default_priority]}`}>
                        {s.default_priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_BADGE[s.status]}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/maintenance/schedules/${s.id}`} className="text-xs text-brand hover:underline">View</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
