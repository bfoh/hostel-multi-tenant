import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { User, Briefcase, Clock, Shield } from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = { title: 'My Account · GH Hostels' }

function date(d: string) {
  return new Intl.DateTimeFormat('en-GH', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d))
}

export default async function MyAccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const h        = await headers()
  const tenantId = h.get('x-tenant-id')
  const color    = h.get('x-tenant-color') ?? '#2563EB'
  const tenantName = h.get('x-tenant-name') ?? 'My Hostel'
  if (!tenantId) redirect('/login')

  const { data: staff } = await supabase
    .from('staff_profiles')
    .select('id, first_name, last_name, job_title, department, phone, employment_type, start_date, employee_id')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .single()

  // Recent attendance
  const { data: attendanceRaw } = await supabase
    .from('staff_attendance')
    .select('date, clock_in, clock_out, status')
    .eq('tenant_id', tenantId)
    .eq('staff_id', staff?.id ?? '')
    .order('date', { ascending: false })
    .limit(5)

  const attendance = attendanceRaw ?? []

  const STATUS_CLS: Record<string, string> = {
    present:  'text-emerald-600',
    absent:   'text-red-500',
    late:     'text-amber-600',
    half_day: 'text-blue-600',
    leave:    'text-purple-600',
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12 pt-4">

      {/* Avatar + name */}
      <div className="flex flex-col items-center gap-3 py-4">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white shadow-md"
          style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}bb 100%)` }}
        >
          {staff?.first_name?.[0]?.toUpperCase()}{staff?.last_name?.[0]?.toUpperCase()}
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-800">
            {staff ? `${staff.first_name} ${staff.last_name}` : user.email}
          </h1>
          {staff?.job_title && (
            <p className="mt-0.5 text-sm text-slate-500 capitalize">{staff.job_title}</p>
          )}
          {staff?.department && (
            <p className="text-xs text-slate-400">{staff.department}</p>
          )}
        </div>
      </div>

      {/* Staff details */}
      {staff && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
            <Briefcase className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-800">Employment Details</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {[
              { label: 'Employee ID',  value: staff.employee_id },
              { label: 'Department',   value: staff.department },
              { label: 'Type',         value: staff.employment_type?.replace('_', ' ') },
              { label: 'Phone',        value: staff.phone },
              { label: 'Start date',   value: staff.start_date ? date(staff.start_date) : null },
            ].filter(r => r.value).map(row => (
              <div key={row.label} className="flex items-center justify-between px-5 py-3.5">
                <p className="text-xs text-slate-400">{row.label}</p>
                <p className="text-sm font-medium text-slate-800 capitalize">{row.value}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent attendance */}
      {attendance.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
            <Clock className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-800">Recent Attendance</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {attendance.map((a: any) => (
              <div key={a.date} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {new Date(a.date).toLocaleDateString('en-GH', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </p>
                  {(a.clock_in || a.clock_out) && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {a.clock_in ? a.clock_in.slice(0, 5) : '—'} → {a.clock_out ? a.clock_out.slice(0, 5) : '—'}
                    </p>
                  )}
                </div>
                <span className={`text-xs font-semibold capitalize ${STATUS_CLS[a.status] ?? 'text-slate-500'}`}>
                  {a.status?.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Account */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
          <Shield className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-800">Account Info</h2>
        </div>
        <div className="divide-y divide-slate-100">
          <div className="flex items-center justify-between px-5 py-3.5">
            <p className="text-xs text-slate-400">Email</p>
            <p className="text-sm font-medium text-slate-800">{user.email}</p>
          </div>
          <div className="flex items-center justify-between px-5 py-3.5">
            <p className="text-xs text-slate-400">Password</p>
            <Link href="/auth/set-password?next=/my-account" className="text-sm font-medium text-blue-600 hover:underline">
              Change Password
            </Link>
          </div>
        </div>
      </section>

      {/* Sign out */}
      <form action="/api/auth/signout" method="POST">
        <button
          type="submit"
          className="w-full rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100"
        >
          Sign out
        </button>
      </form>

      <p className="pb-2 text-center text-xs text-slate-400">GH Hostels · {tenantName}</p>
    </div>
  )
}
