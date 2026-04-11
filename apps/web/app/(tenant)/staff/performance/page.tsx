import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, TrendingUp, Clock, Calendar, CheckCircle2, AlertCircle } from 'lucide-react'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { initials } from '@/lib/utils'

export const metadata: Metadata = { title: 'Staff Performance' }

function workingDaysInMonth(year: number, month: number): number {
  // Count Mon–Fri days (Sat/Sun excluded)
  let count = 0
  const days = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= days; d++) {
    const dow = new Date(year, month, d).getDay()
    if (dow !== 0 && dow !== 6) count++
  }
  return count
}

interface StaffPerf {
  id: string
  name: string
  role: string
  department: string | null
  daysPresent: number
  hoursWorked: number
  avgHours: number
  attendanceRate: number
  leaveDays: number
  lateArrivals: number
  punctualityRate: number
}

export default async function StaffPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { month: monthParam } = await searchParams
  const currentMonth = monthParam ?? new Date().toISOString().slice(0, 7)
  const [yearStr, monthStr] = currentMonth.split('-')
  const year  = parseInt(yearStr)
  const month = parseInt(monthStr) - 1  // 0-indexed

  const startDate = new Date(year, month, 1).toISOString().split('T')[0]
  const endDate   = new Date(year, month + 1, 0).toISOString().split('T')[0]
  const workingDays = workingDaysInMonth(year, month)

  const headersList = await headers()
  const tenantId    = headersList.get('x-tenant-id') ?? ''
  const supabase    = await createClient()

  const [{ data: staff }, { data: attendance }, { data: leaves }] = await Promise.all([
    supabase
      .from('staff_profiles')
      .select('id, first_name, last_name, role, department')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('first_name'),
    supabase
      .from('attendance_records')
      .select('staff_id, date, clock_in, clock_out, status')
      .eq('tenant_id', tenantId)
      .gte('date', startDate)
      .lte('date', endDate),
    supabase
      .from('leave_requests')
      .select('staff_id, start_date, end_date')
      .eq('tenant_id', tenantId)
      .eq('status', 'approved')
      .gte('start_date', startDate)
      .lte('end_date', endDate),
  ])

  // Standard start time for punctuality (9:00 AM)
  const EXPECTED_START_HOUR = 9

  const perfs: StaffPerf[] = ((staff ?? []) as any[]).map(s => {
    const records = ((attendance ?? []) as any[]).filter(a => a.staff_id === s.id)
    const daysPresent = records.filter(r => r.status === 'present').length

    let totalMinutes = 0
    let lateArrivals = 0

    for (const r of records) {
      if (r.clock_in && r.clock_out) {
        const diff = (new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime()) / 60000
        totalMinutes += diff
      }
      if (r.clock_in) {
        const hour = new Date(r.clock_in).getHours()
        if (hour > EXPECTED_START_HOUR) lateArrivals++
      }
    }

    const hoursWorked      = totalMinutes / 60
    const avgHours         = daysPresent > 0 ? hoursWorked / daysPresent : 0
    const attendanceRate   = workingDays > 0 ? Math.round((daysPresent / workingDays) * 100) : 0
    const punctualityRate  = daysPresent > 0 ? Math.round(((daysPresent - lateArrivals) / daysPresent) * 100) : 100

    // Count approved leave days overlapping this month
    let leaveDays = 0
    for (const l of (leaves ?? []).filter(lv => lv.staff_id === s.id)) {
      const ls = new Date(Math.max(new Date(l.start_date).getTime(), new Date(startDate).getTime()))
      const le = new Date(Math.min(new Date(l.end_date).getTime(), new Date(endDate).getTime()))
      let cur = new Date(ls)
      while (cur <= le) {
        const dow = cur.getDay()
        if (dow !== 0 && dow !== 6) leaveDays++
        cur.setDate(cur.getDate() + 1)
      }
    }

    return {
      id:             s.id,
      name:           `${s.first_name} ${s.last_name}`,
      role:           s.role ?? 'Staff',
      department:     s.department ?? null,
      daysPresent,
      hoursWorked,
      avgHours,
      attendanceRate,
      leaveDays,
      lateArrivals,
      punctualityRate,
    }
  })

  // Sort by attendance rate desc
  perfs.sort((a, b) => b.attendanceRate - a.attendanceRate)

  // Team summary
  const teamAvgAttendance  = perfs.length > 0 ? Math.round(perfs.reduce((s, p) => s + p.attendanceRate, 0) / perfs.length) : 0
  const teamAvgPunctuality = perfs.length > 0 ? Math.round(perfs.reduce((s, p) => s + p.punctualityRate, 0) / perfs.length) : 0
  const totalHours         = perfs.reduce((s, p) => s + p.hoursWorked, 0)

  function perfColor(rate: number) {
    if (rate >= 80) return 'text-success'
    if (rate >= 60) return 'text-warning'
    return 'text-danger'
  }

  function perfBg(rate: number) {
    if (rate >= 80) return 'bg-success'
    if (rate >= 60) return 'bg-warning'
    return 'bg-danger'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Link href="/staff" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
            <ChevronLeft className="h-4 w-4" /> Staff
          </Link>
          <span className="text-text-disabled">/</span>
          <h1 className="text-xl font-bold text-text-primary">Performance</h1>
        </div>
        <form method="get">
          <input
            type="month"
            name="month"
            defaultValue={currentMonth}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button type="submit" className="ml-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors">
            Go
          </button>
        </form>
      </div>

      {/* Team summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Team attendance', value: `${teamAvgAttendance}%`, icon: CheckCircle2, color: perfColor(teamAvgAttendance) },
          { label: 'Team punctuality', value: `${teamAvgPunctuality}%`, icon: Clock, color: perfColor(teamAvgPunctuality) },
          { label: 'Total hours logged', value: `${totalHours.toFixed(0)}h`, icon: TrendingUp, color: 'text-primary' },
          { label: 'Working days in month', value: workingDays, icon: Calendar, color: 'text-text-secondary' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center gap-2 text-text-tertiary">
              <Icon className={`h-4 w-4 ${color}`} />
              <p className="text-xs font-medium text-text-secondary">{label}</p>
            </div>
            <p className={`mt-1 text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Performance table */}
      {perfs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-text-disabled mb-2" />
          <p className="text-sm font-medium text-text-primary">No staff records found</p>
          <p className="text-xs text-text-secondary mt-1">Add staff and clock-in attendance to see performance here.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-raised">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Staff member</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary">Days present</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary">Hours worked</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary">Leave days</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary w-40">Attendance</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary w-40">Punctuality</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {perfs.map(p => (
                  <tr key={p.id} className="hover:bg-surface-raised/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                          {initials(p.name)}
                        </div>
                        <div>
                          <Link href={`/staff/${p.id}`} className="font-medium text-text-primary hover:text-primary transition-colors">
                            {p.name}
                          </Link>
                          <p className="text-xs text-text-tertiary capitalize">{p.role}{p.department ? ` · ${p.department}` : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-text-primary">
                      {p.daysPresent}<span className="text-text-tertiary">/{workingDays}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-text-primary">
                      {p.hoursWorked.toFixed(1)}h
                      {p.daysPresent > 0 && (
                        <span className="text-xs text-text-tertiary ml-1">({p.avgHours.toFixed(1)}/d)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={p.leaveDays > 0 ? 'text-info' : 'text-text-tertiary'}>{p.leaveDays}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                          <div className={`h-full rounded-full ${perfBg(p.attendanceRate)}`} style={{ width: `${p.attendanceRate}%` }} />
                        </div>
                        <span className={`text-xs font-semibold tabular-nums w-8 text-right ${perfColor(p.attendanceRate)}`}>{p.attendanceRate}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                          <div className={`h-full rounded-full ${perfBg(p.punctualityRate)}`} style={{ width: `${p.punctualityRate}%` }} />
                        </div>
                        <span className={`text-xs font-semibold tabular-nums w-8 text-right ${perfColor(p.punctualityRate)}`}>{p.punctualityRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border px-4 py-2.5">
            <p className="text-xs text-text-tertiary">
              Attendance rate = days present ÷ {workingDays} working days.
              Punctuality = on-time arrivals (before 9:00 AM) ÷ days present.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
