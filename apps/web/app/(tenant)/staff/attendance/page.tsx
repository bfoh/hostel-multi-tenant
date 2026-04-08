import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, Clock, LogIn, LogOut } from 'lucide-react'

import { getAttendanceRecords, getStaff } from '@/lib/data/staff'
import { formatDate, initials } from '@/lib/utils'
import { ClockActions } from '@/components/staff/clock-actions'

export const metadata: Metadata = { title: 'Attendance' }

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; staff_id?: string }>
}) {
  const { month, staff_id } = await searchParams

  // Default to current month
  const currentMonth = month ?? new Date().toISOString().slice(0, 7)

  const [records, allStaff] = await Promise.all([
    getAttendanceRecords({ month: currentMonth, staffId: staff_id }),
    getStaff(),
  ])

  const totalPresent = records.length
  const totalHours = records.reduce((sum, r) => {
    if (!r.clock_in || !r.clock_out) return sum
    return sum + (new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime()) / 3600000
  }, 0)

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/staff" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
            <ChevronLeft className="h-4 w-4" /> Staff
          </Link>
          <span className="text-text-disabled">/</span>
          <h1 className="text-xl font-bold text-text-primary">Attendance</h1>
        </div>
        <ClockActions staff={allStaff} />
      </div>

      {/* ── Filters ──────────────────────────────────────────────── */}
      <form method="get" className="flex gap-3 flex-wrap">
        <div>
          <label className="block text-xs text-text-secondary mb-1">Month</label>
          <input
            name="month"
            type="month"
            defaultValue={currentMonth}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">Staff member</label>
          <select
            name="staff_id"
            defaultValue={staff_id ?? ''}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand transition-colors"
          >
            <option value="">All staff</option>
            {allStaff.map(s => (
              <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
            ))}
          </select>
        </div>
        <div className="self-end">
          <button type="submit" className="rounded-md bg-brand px-4 py-1.5 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors">
            Filter
          </button>
        </div>
      </form>

      {/* ── KPI strip ────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-text-secondary text-sm">
            <Clock className="h-4 w-4" /> Attendance entries
          </div>
          <p className="mt-1.5 text-2xl font-bold text-text-primary">{totalPresent}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-text-secondary text-sm">
            <LogIn className="h-4 w-4" /> Clocked out
          </div>
          <p className="mt-1.5 text-2xl font-bold text-text-primary">
            {records.filter(r => r.clock_out).length}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-text-secondary text-sm">
            <LogOut className="h-4 w-4" /> Total hours
          </div>
          <p className="mt-1.5 text-2xl font-bold text-text-primary">{totalHours.toFixed(1)}h</p>
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────── */}
      {records.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <Clock className="h-10 w-10 text-text-disabled" />
          <p className="font-medium text-text-primary">No attendance records for this period</p>
          <p className="text-sm text-text-secondary">Use the clock-in button to start tracking attendance.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Staff</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Clock in</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Clock out</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Hours</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium text-text-tertiary md:table-cell">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {records.map(rec => {
                const s = Array.isArray(rec.staff) ? rec.staff[0] : rec.staff
                const hours = rec.clock_in && rec.clock_out
                  ? ((new Date(rec.clock_out).getTime() - new Date(rec.clock_in).getTime()) / 3600000).toFixed(1)
                  : null
                return (
                  <tr key={rec.id} className="hover:bg-surface-raised transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/staff/${rec.staff_id}?tab=attendance`} className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-[10px] font-semibold text-brand">
                          {s ? initials(`${s.first_name} ${s.last_name}`) : '?'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-text-primary hover:text-brand transition-colors">
                            {s ? `${s.first_name} ${s.last_name}` : 'Unknown'}
                          </p>
                          {s?.job_title && <p className="text-xs text-text-tertiary">{s.job_title}</p>}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-primary">{formatDate(rec.date)}</td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {rec.clock_in ? new Date(rec.clock_in).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {rec.clock_out
                        ? new Date(rec.clock_out).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })
                        : <span className="inline-flex items-center gap-1 text-success text-xs font-medium"><span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> On duty</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">{hours ? `${hours}h` : '—'}</td>
                    <td className="hidden px-4 py-3 text-sm text-text-tertiary md:table-cell">{rec.notes ?? '—'}</td>
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
