import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  User, MessageCircle, Users, Wrench, Sparkles, LayoutDashboard, Settings, ChevronRight,
} from 'lucide-react'

export const metadata: Metadata = { title: 'More · Owner' }
export const dynamic = 'force-dynamic'

const LINKS = [
  { href: '/my-account', label: 'My profile',      sub: 'Account details & password',        icon: User },
  { href: '/messages',   label: 'Messages',         sub: 'Guests, staff & announcements',     icon: MessageCircle },
  { href: '/occupants',  label: 'Occupants',        sub: 'Current residents & applications',  icon: Users },
  { href: '/maintenance',label: 'Maintenance',      sub: 'All requests across the hostel',    icon: Wrench },
  { href: '/housekeeping',label: 'Housekeeping',    sub: 'Room turnover & task board',         icon: Sparkles },
  { href: '/settings',   label: 'Settings',         sub: 'Hostel, staff & integrations',      icon: Settings },
  { href: '/dashboard',  label: 'Full dashboard',   sub: 'Everything, desktop-style',          icon: LayoutDashboard },
]

export default async function OwnerMobileMorePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const h          = await headers()
  const tenantName = h.get('x-tenant-name') ?? 'My Hostel'
  const color      = h.get('x-tenant-color') ?? '#2F7D57'

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-2 py-2 text-center">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-white shadow-md"
          style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}bb 100%)` }}
        >
          {(user.email ?? 'O').charAt(0).toUpperCase()}
        </div>
        <p className="text-sm font-medium text-slate-500">{user.email}</p>
      </div>

      <section className="space-y-2.5">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors active:bg-slate-50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}18` }}>
              <l.icon className="h-4.5 w-4.5" style={{ color }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800">{l.label}</p>
              <p className="text-xs text-slate-500">{l.sub}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
          </Link>
        ))}
      </section>

      <form action="/api/auth/signout" method="POST">
        <button
          type="submit"
          className="w-full rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100"
        >
          Sign out
        </button>
      </form>

      <p className="pb-2 text-center text-[10px] text-slate-300">{tenantName} · Owner</p>
    </div>
  )
}
