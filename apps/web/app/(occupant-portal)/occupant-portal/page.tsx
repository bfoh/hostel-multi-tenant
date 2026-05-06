import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOccupantSession } from '@/lib/auth/occupant-session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  BedDouble, CreditCard, FileText, Wrench, AlertCircle,
  CheckCircle2, Clock, XCircle, ChevronRight,
  Bell, ArrowRight, Calendar,
} from 'lucide-react'

export const metadata: Metadata = { title: 'Home · Resident Portal' }

function ghs(pesewas: number) {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(pesewas / 100)
}
function date(d: string) {
  return new Intl.DateTimeFormat('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d))
}

const STATUS: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
  pending_payment: { label: 'Pending Payment', cls: 'bg-amber-50 text-amber-700 border-amber-200',      Icon: Clock        },
  confirmed:       { label: 'Confirmed',        cls: 'bg-blue-50 text-blue-700 border-blue-200',         Icon: CheckCircle2 },
  checked_in:      { label: 'Checked In',       cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: BedDouble   },
  checked_out:     { label: 'Checked Out',      cls: 'bg-slate-50 text-slate-600 border-slate-200',      Icon: CheckCircle2 },
  cancelled:       { label: 'Cancelled',         cls: 'bg-red-50 text-red-700 border-red-200',            Icon: XCircle     },
}

const NOTICE_COLORS: Record<string, string> = {
  urgent:      'bg-red-50 text-red-700 border-red-200',
  payment:     'bg-amber-50 text-amber-700 border-amber-200',
  maintenance: 'bg-orange-50 text-orange-700 border-orange-200',
  event:       'bg-purple-50 text-purple-700 border-purple-200',
  general:     'bg-slate-50 text-slate-600 border-slate-200',
}

export default async function OccupantPortalHome() {
  const session = await getOccupantSession()
  if (!session) redirect('/login')

  const { occupantId, tenantId, tenantColor: color, firstName, lastName } = session
  const admin = createAdminClient()

  // Fetch occupant details + bookings + notices in parallel
  const [{ data: occupant }, { data: bookingsRaw }, { data: noticesRaw }] = await Promise.all([
    admin
      .from('occupants')
      .select('student_id, institution, programme')
      .eq('id', occupantId)
      .single(),

    admin
      .from('bookings')
      .select(`
        id, booking_ref, status, payment_status,
        check_in_date, check_out_date, final_amount, paid_amount,
        rooms(room_number, block, floor, room_categories(name))
      `)
      .eq('occupant_id', occupantId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(10),

    admin
      .from('notices')
      .select('id, title, category, is_pinned, published_at')
      .eq('tenant_id', tenantId)
      .lte('published_at', new Date().toISOString())
      .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`)
      .order('is_pinned', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(3),
  ])

  const bookings = bookingsRaw ?? []
  const notices  = (noticesRaw  ?? []) as any[]

  const active   = bookings.find(b => b.status === 'checked_in')
  const upcoming = bookings.find(b => b.status === 'confirmed')
  const featured = active ?? upcoming ?? bookings[0] ?? null

  const room     = featured ? (Array.isArray(featured.rooms) ? featured.rooms[0] : featured.rooms) as any : null
  const category = room?.room_categories ? (Array.isArray(room.room_categories) ? room.room_categories[0] : room.room_categories) as any : null
  const status   = featured ? STATUS[featured.status] : null
  const balance  = featured ? featured.final_amount - featured.paid_amount : 0

  return (
    <div className="space-y-4">

      {/* ── Welcome card ────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-2xl p-5 text-white shadow-lg"
        style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)` }}
      >
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
        <div className="absolute -bottom-4 right-8 h-20 w-20 rounded-full bg-white/5" />

        <div className="relative">
          <p className="text-[13px] text-white/70">Welcome back</p>
          <h1 className="mt-0.5 font-display text-2xl font-bold leading-tight">
            {firstName} {lastName}
          </h1>
          {occupant?.student_id && (
            <p className="mt-1 font-mono text-sm text-white/60">{occupant.student_id}</p>
          )}
          {occupant?.institution && (
            <p className="mt-0.5 text-[13px] text-white/55">{occupant.institution}</p>
          )}
        </div>

        <div className="relative mt-5 flex gap-2">
          <Link href="/occupant-portal/payments" className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/15 border border-white/20 px-3 py-2 text-xs font-semibold text-white hover:bg-white/25 transition-colors">
            <CreditCard className="h-3.5 w-3.5" /> Payments
          </Link>
          <Link href="/occupant-portal/maintenance/new" className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/15 border border-white/20 px-3 py-2 text-xs font-semibold text-white hover:bg-white/25 transition-colors">
            <Wrench className="h-3.5 w-3.5" /> Report issue
          </Link>
          <Link href="/occupant-portal/notices" className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/15 border border-white/20 px-3 py-2 text-xs font-semibold text-white hover:bg-white/25 transition-colors">
            <Bell className="h-3.5 w-3.5" /> Notices
          </Link>
        </div>
      </div>

      {/* ── Current / Featured booking ─────────────────────────── */}
      {featured ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-800">
              {active ? 'Current Stay' : upcoming ? 'Upcoming Booking' : 'Latest Booking'}
            </h2>
            {status && (
              <span className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${status.cls}`}>
                <status.Icon className="h-3 w-3" />
                {status.label}
              </span>
            )}
          </div>

          <div className="px-5 py-4 space-y-3.5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  Room {room?.room_number ?? '—'}
                  {room?.block && <span className="ml-1.5 text-base font-normal text-slate-400">{room.block}</span>}
                </p>
                {category && <p className="text-sm text-slate-500">{category.name}</p>}
              </div>
              <p className="font-mono text-[11px] text-slate-400 mt-1">{featured.booking_ref}</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 rounded-xl bg-slate-50 p-3">
              <div>
                <p className="text-[11px] text-slate-400">Check-in</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-700">{date(featured.check_in_date)}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-400">Check-out</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-700">
                  {featured.check_out_date ? date(featured.check_out_date) : 'Ongoing'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-400">Total fee</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-700">{ghs(featured.final_amount)}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-400">Balance due</p>
                <p className={`mt-0.5 text-sm font-semibold ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {balance > 0 ? ghs(balance) : 'Paid in full ✓'}
                </p>
              </div>
            </div>

            {balance > 0 && (
              <Link
                href="/occupant-portal/payments"
                className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: color }}
              >
                Pay {ghs(balance)} now <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </section>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
          <Calendar className="mx-auto h-8 w-8 text-slate-300 mb-2" />
          <p className="text-sm font-medium text-slate-500">No bookings yet</p>
          <p className="text-xs text-slate-400 mt-0.5">Contact reception to make a booking.</p>
        </div>
      )}

      {/* ── Notices preview ────────────────────────────────────── */}
      {notices.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Bell className="h-4 w-4 text-slate-400" /> Notices
            </h2>
            <Link href="/occupant-portal/notices" className="flex items-center gap-0.5 text-xs font-medium hover:underline" style={{ color }}>
              View all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {notices.map((n) => (
              <div key={n.id} className="flex items-start gap-3 px-5 py-3.5">
                <span className={`mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${NOTICE_COLORS[n.category] ?? NOTICE_COLORS.general}`}>
                  {n.is_pinned ? '📌 ' : ''}{n.category}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{n.title}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{date(n.published_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Quick links ────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-800">Quick links</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {[
            { href: '/occupant-portal/payments',    icon: CreditCard, label: 'View payment history',    sub: 'Fees paid and outstanding balance'  },
            { href: '/occupant-portal/invoices',    icon: FileText,   label: 'View invoices',           sub: 'Download tax-compliant receipts'    },
            { href: '/occupant-portal/maintenance',  icon: Wrench,     label: 'Maintenance requests',    sub: 'Track submitted issues'              },
            { href: '/occupant-portal/notices',      icon: Bell,       label: 'Hostel notices',          sub: 'Announcements from management'       },
            { href: '/occupant-portal/profile',      icon: AlertCircle,label: 'My profile',              sub: 'Update your personal information'    },
          ].map(({ href, icon: Icon, label, sub }) => (
            <Link key={href} href={href} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}15` }}>
                <Icon className="h-4 w-4" style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">{label}</p>
                <p className="text-[11px] text-slate-400">{sub}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
            </Link>
          ))}
        </div>
      </section>

    </div>
  )
}
