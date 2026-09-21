import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import {
  ClipboardList, Wrench, CalendarCheck, BedDouble, ChevronRight,
} from 'lucide-react'
import { getTenantToday, getDailyReport } from '@/lib/reports/daily'

export const metadata: Metadata = { title: 'Staff Home' }
export const dynamic = 'force-dynamic'

const MONEY_ROLES = new Set(['manager', 'accountant'])

export default async function StaffMobileHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const h          = await headers()
  const tenantId   = h.get('x-tenant-id')
  const tenantRole = h.get('x-tenant-role') ?? ''
  const color      = h.get('x-tenant-color') ?? '#2F7D57'
  if (!tenantId) redirect('/login')

  const admin = createAdminClient() as any

  const { data: staffProfile } = await admin
    .from('staff_profiles')
    .select('id, first_name, last_name, job_title')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .maybeSingle()

  const today = await getTenantToday(tenantId)
  const report = await getDailyReport(tenantId, today)

  const [{ count: myTaskCount }, { count: openMaintCount }] = await Promise.all([
    staffProfile
      ? admin
          .from('housekeeping_tasks')
          .select('id', { head: true, count: 'exact' })
          .eq('tenant_id', tenantId)
          .eq('assigned_to', staffProfile.id)
          .neq('status', 'done')
      : Promise.resolve({ count: 0 }),
    admin
      .from('maintenance_requests')
      .select('id', { head: true, count: 'exact' })
      .eq('tenant_id', tenantId)
      .in('status', ['open', 'in_progress']),
  ])

  const dateLabel = new Date().toLocaleDateString('en-GH', { weekday: 'long', day: 'numeric', month: 'long' })
  const showMoney = MONEY_ROLES.has(tenantRole) || tenantRole === 'manager'

  const stats = [
    { label: 'Occupancy',       value: report ? `${Math.round(report.occupancy_pct)}%` : '—', icon: BedDouble,     color: 'bg-blue-500' },
    { label: 'Arrivals today',  value: report?.arrivals_today ?? 0,                             icon: CalendarCheck, color: 'bg-emerald-500' },
    { label: 'Departures today',value: report?.departures_today ?? 0,                           icon: CalendarCheck, color: 'bg-purple-500' },
    { label: 'My tasks',        value: myTaskCount ?? 0,                                        icon: ClipboardList, color: 'bg-amber-500' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">{dateLabel}</p>
        <h1 className="mt-0.5 text-2xl font-bold text-slate-900">
          {staffProfile ? `Hello, ${staffProfile.first_name} 👋` : 'Welcome back'}
        </h1>
        {staffProfile?.job_title && (
          <p className="mt-0.5 text-sm capitalize text-slate-500">{staffProfile.job_title}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl ${s.color}`}>
              <s.icon className="h-4 w-4 text-white" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{s.value}</p>
            <p className="mt-0.5 text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {showMoney && report && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-800">Today&apos;s revenue</h2>
          </div>
          <div className="flex items-center justify-between px-5 py-3.5">
            <p className="text-xs text-slate-400">Total collected</p>
            <p className="text-lg font-bold text-slate-900">
              GH₵ {(report.revenue_total / 100).toLocaleString('en-GH', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3.5">
            <p className="text-xs text-slate-400">Outstanding balance</p>
            <p className="text-sm font-semibold text-red-600">
              GH₵ {(report.outstanding_balance / 100).toLocaleString('en-GH', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2.5">
        <Link
          href="/staff-mobile/tasks"
          className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors active:bg-slate-50"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}18` }}>
            <ClipboardList className="h-4.5 w-4.5" style={{ color }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-800">My tasks</p>
            <p className="text-xs text-slate-500">{myTaskCount ?? 0} pending housekeeping tasks</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
        </Link>

        <Link
          href="/staff-mobile/tasks"
          className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors active:bg-slate-50"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50">
            <Wrench className="h-4.5 w-4.5 text-orange-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-800">Open maintenance</p>
            <p className="text-xs text-slate-500">{openMaintCount ?? 0} open requests across the hostel</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
        </Link>

        <Link
          href="/staff-mobile/bookings"
          className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors active:bg-slate-50"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50">
            <BedDouble className="h-4.5 w-4.5 text-blue-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-800">Bookings</p>
            <p className="text-xs text-slate-500">View recent reservations</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
        </Link>
      </div>
    </div>
  )
}
