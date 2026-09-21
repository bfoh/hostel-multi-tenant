import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  Briefcase, LayoutDashboard, Wallet, BarChart3, Users, Settings, ChevronRight,
} from 'lucide-react'

export const metadata: Metadata = { title: 'More · Staff' }
export const dynamic = 'force-dynamic'

/**
 * Role-gated link-outs to desktop-only sections of the admin app. Mobile
 * gets dedicated tabs for the day-to-day (Home/Bookings/Tasks/Messages);
 * everything else stays reachable here by direct in-webview navigation
 * rather than being rebuilt as a native-feeling screen — see the mobile
 * parity plan's stated interpretation of "full feature parity".
 */
const LINKS: Array<{ href: string; label: string; icon: any; roles: string[] }> = [
  { href: '/dashboard',      label: 'Full dashboard',    icon: LayoutDashboard, roles: ['owner', 'manager', 'receptionist', 'housekeeper', 'accountant', 'security'] },
  { href: '/accounting',     label: 'Accounting',        icon: Wallet,          roles: ['owner', 'manager', 'accountant'] },
  { href: '/reports',        label: 'Reports',           icon: BarChart3,       roles: ['owner', 'manager', 'accountant'] },
  { href: '/staff',          label: 'Staff',             icon: Users,           roles: ['owner', 'manager'] },
  { href: '/settings',       label: 'Settings',          icon: Settings,        roles: ['owner', 'manager'] },
]

export default async function StaffMobileMorePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const h          = await headers()
  const tenantId   = h.get('x-tenant-id')
  const tenantRole = h.get('x-tenant-role') ?? ''
  const tenantName = h.get('x-tenant-name') ?? 'My Hostel'
  const color       = h.get('x-tenant-color') ?? '#2F7D57'
  if (!tenantId) redirect('/login')

  const admin = createAdminClient() as any
  const { data: staffProfile } = await admin
    .from('staff_profiles')
    .select('first_name, last_name, job_title, department, phone, employee_id')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .maybeSingle()

  const visibleLinks = LINKS.filter((l) => l.roles.includes(tenantRole))

  return (
    <div className="space-y-5">
      {/* Avatar + name */}
      <div className="flex flex-col items-center gap-3 py-4">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white shadow-md"
          style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}bb 100%)` }}
        >
          {staffProfile?.first_name?.[0]?.toUpperCase()}{staffProfile?.last_name?.[0]?.toUpperCase()}
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-800">
            {staffProfile ? `${staffProfile.first_name} ${staffProfile.last_name}` : user.email}
          </h1>
          {staffProfile?.job_title && (
            <p className="mt-0.5 text-sm capitalize text-slate-500">{staffProfile.job_title}</p>
          )}
        </div>
      </div>

      {/* Staff details */}
      {staffProfile && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
            <Briefcase className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-800">Employment Details</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {[
              { label: 'Employee ID', value: staffProfile.employee_id },
              { label: 'Department',  value: staffProfile.department },
              { label: 'Phone',       value: staffProfile.phone },
            ].filter((r) => r.value).map((row) => (
              <div key={row.label} className="flex items-center justify-between px-5 py-3.5">
                <p className="text-xs text-slate-400">{row.label}</p>
                <p className="text-sm font-medium capitalize text-slate-800">{row.value}</p>
              </div>
            ))}
            <div className="flex items-center justify-between px-5 py-3.5">
              <p className="text-xs text-slate-400">Email</p>
              <p className="text-sm font-medium text-slate-800">{user.email}</p>
            </div>
            <div className="flex items-center justify-between px-5 py-3.5">
              <p className="text-xs text-slate-400">Hostel</p>
              <p className="text-sm font-medium text-slate-800">{tenantName}</p>
            </div>
          </div>
        </section>
      )}

      {/* Link-outs */}
      {visibleLinks.length > 0 && (
        <section className="space-y-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">More tools</p>
          {visibleLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors active:bg-slate-50"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}18` }}>
                <l.icon className="h-4.5 w-4.5" style={{ color }} />
              </div>
              <p className="flex-1 text-sm font-semibold text-slate-800">{l.label}</p>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
            </Link>
          ))}
        </section>
      )}

      {/* Sign out */}
      <form action="/api/auth/signout" method="POST">
        <button
          type="submit"
          className="w-full rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100"
        >
          Sign out
        </button>
      </form>

      <p className="pb-2 text-center text-[10px] text-slate-300">{tenantName} · Staff Portal</p>
    </div>
  )
}
