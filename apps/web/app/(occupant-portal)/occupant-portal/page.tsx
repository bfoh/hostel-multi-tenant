import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOccupantSession } from '@/lib/auth/occupant-session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  BedDouble, CreditCard, FileText, Wrench, UserRound,
  CheckCircle2, Clock, XCircle, ChevronRight,
  Bell, ArrowRight, Calendar, MessageCircle,
} from 'lucide-react'

export const metadata: Metadata = { title: 'Home · Resident Portal' }

function ghs(pesewas: number) {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(pesewas / 100)
}
function date(d: string) {
  return new Intl.DateTimeFormat('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d))
}

const STATUS: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
  pending_payment: { label: 'Pending Payment', cls: 'bg-amber-50 text-amber-700 ring-amber-200/70',       Icon: Clock        },
  confirmed:       { label: 'Confirmed',        cls: 'bg-blue-50 text-blue-700 ring-blue-200/70',          Icon: CheckCircle2 },
  checked_in:      { label: 'Checked In',       cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70', Icon: BedDouble    },
  checked_out:     { label: 'Checked Out',      cls: 'bg-slate-50 text-slate-600 ring-slate-200/70',       Icon: CheckCircle2 },
  cancelled:       { label: 'Cancelled',         cls: 'bg-red-50 text-red-700 ring-red-200/70',             Icon: XCircle      },
}

const NOTICE_COLORS: Record<string, string> = {
  urgent:      'bg-red-50 text-red-700 ring-red-200/70',
  payment:     'bg-amber-50 text-amber-700 ring-amber-200/70',
  maintenance: 'bg-orange-50 text-orange-700 ring-orange-200/70',
  event:       'bg-purple-50 text-purple-700 ring-purple-200/70',
  general:     'bg-slate-50 text-slate-600 ring-slate-200/70',
}

const CARD = 'rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_28px_-18px_rgba(16,24,40,0.20)]'

export default async function OccupantPortalHome() {
  const session = await getOccupantSession()
  if (!session) redirect('/login')

  const { occupantId, tenantId, tenantColor: color, firstName, lastName } = session
  const admin = createAdminClient()

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
  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase()

  return (
    <div className="space-y-4">

      {/* ── Welcome card ────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden rounded-[20px] p-5 text-white shadow-[0_10px_30px_-12px_rgba(16,24,40,0.45)]"
        style={{ background: `linear-gradient(150deg, ${color} 0%, ${color}d9 55%, ${color}b3 100%)` }}
      >
        {/* soft light glow — replaces the old hard circles */}
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-60"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.22) 0%, transparent 70%)' }}
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-10 h-52 w-52 rounded-full opacity-50"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)' }}
        />

        <div className="relative flex items-center gap-3.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-lg font-bold ring-1 ring-white/25 backdrop-blur-sm">
            {initials || <UserRound className="h-6 w-6" />}
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-white/70">Welcome back</p>
            <h1 className="truncate font-display text-[22px] font-bold leading-tight">
              {firstName} {lastName}
            </h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-white/65">
              {occupant?.student_id && <span className="font-mono">{occupant.student_id}</span>}
              {occupant?.student_id && occupant?.institution && <span className="text-white/35">·</span>}
              {occupant?.institution && <span>{occupant.institution}</span>}
            </p>
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-3 gap-2">
          {[
            { href: '/occupant-portal/payments',        Icon: CreditCard, label: 'Payments' },
            { href: '/occupant-portal/maintenance/new', Icon: Wrench,     label: 'Report' },
            { href: '/occupant-portal/notices',         Icon: Bell,       label: 'Notices' },
          ].map(({ href, Icon, label }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/15 bg-white/12 py-3 text-[12px] font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/22 active:scale-95"
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
              {label}
            </Link>
          ))}
        </div>
      </section>

      {/* ── Current / Featured booking ─────────────────────────── */}
      {featured ? (
        <section className={`overflow-hidden ${CARD}`}>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <h2 className="text-[13px] font-semibold tracking-tight text-slate-800">
              {active ? 'Current Stay' : upcoming ? 'Upcoming Booking' : 'Latest Booking'}
            </h2>
            {status && (
              <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${status.cls}`}>
                <status.Icon className="h-3 w-3" />
                {status.label}
              </span>
            )}
          </div>

          <div className="space-y-3.5 px-5 py-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[26px] font-bold leading-none tracking-tight text-slate-900">
                  Room {room?.room_number ?? '—'}
                  {room?.block && <span className="ml-1.5 text-base font-medium text-slate-400">{room.block}</span>}
                </p>
                {category && <p className="mt-1 text-[13px] text-slate-500">{category.name}</p>}
              </div>
              <p className="mt-1 font-mono text-[11px] text-slate-400">{featured.booking_ref}</p>
            </div>

            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-slate-100">
              {[
                { label: 'Check-in',   value: date(featured.check_in_date) },
                { label: 'Check-out',  value: featured.check_out_date ? date(featured.check_out_date) : 'Ongoing' },
                { label: 'Total fee',  value: ghs(featured.final_amount) },
                { label: 'Balance due', value: balance > 0 ? ghs(balance) : 'Paid in full',
                  tone: balance > 0 ? 'text-red-600' : 'text-emerald-600' },
              ].map((cell) => (
                <div key={cell.label} className="bg-slate-50/80 px-3.5 py-2.5">
                  <p className="text-[11px] font-medium text-slate-400">{cell.label}</p>
                  <p className={`mt-0.5 text-[14px] font-semibold ${cell.tone ?? 'text-slate-700'}`}>{cell.value}</p>
                </div>
              ))}
            </div>

            {balance > 0 && (
              <Link
                href="/occupant-portal/payments"
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[14px] font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ backgroundColor: color }}
              >
                Pay {ghs(balance)} now <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </section>
      ) : (
        <div className={`flex flex-col items-center px-6 py-10 text-center ${CARD}`}>
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-100">
            <Calendar className="h-7 w-7 text-slate-300" />
          </span>
          <p className="mt-3 text-[14px] font-semibold text-slate-700">No bookings yet</p>
          <p className="mt-0.5 text-[12.5px] text-slate-400">Contact reception to make a booking.</p>
        </div>
      )}

      {/* ── Notices preview ────────────────────────────────────── */}
      {notices.length > 0 && (
        <section className={`overflow-hidden ${CARD}`}>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <h2 className="flex items-center gap-2 text-[13px] font-semibold tracking-tight text-slate-800">
              <Bell className="h-4 w-4 text-slate-400" /> Notices
            </h2>
            <Link href="/occupant-portal/notices" className="flex items-center gap-0.5 text-[12px] font-semibold transition-opacity hover:opacity-70" style={{ color }}>
              View all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {notices.map((n) => (
              <Link
                key={n.id}
                href="/occupant-portal/notices"
                className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/70"
              >
                <span className={`mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${NOTICE_COLORS[n.category] ?? NOTICE_COLORS.general}`}>
                  {n.is_pinned ? '★ ' : ''}{n.category}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-slate-800">{n.title}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{date(n.published_at)}</p>
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Quick links ────────────────────────────────────────── */}
      <section className={`overflow-hidden ${CARD}`}>
        <div className="border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-[13px] font-semibold tracking-tight text-slate-800">Quick links</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {[
            { href: '/occupant-portal/payments',    icon: CreditCard,    label: 'View payment history', sub: 'Fees paid and outstanding balance' },
            { href: '/occupant-portal/invoices',    icon: FileText,      label: 'View invoices',        sub: 'Download tax-compliant receipts'   },
            { href: '/occupant-portal/maintenance', icon: Wrench,        label: 'Maintenance requests', sub: 'Track submitted issues'             },
            { href: '/occupant-portal/messages',    icon: MessageCircle, label: 'Messages',             sub: 'Chat with hostel management'        },
            { href: '/occupant-portal/notices',     icon: Bell,          label: 'Hostel notices',       sub: 'Announcements from management'      },
            { href: '/occupant-portal/profile',     icon: UserRound,     label: 'My profile',           sub: 'Update your personal information'   },
          ].map(({ href, icon: Icon, label, sub }) => (
            <Link key={href} href={href} className="flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-slate-50/70">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}14` }}>
                <Icon className="h-[18px] w-[18px]" style={{ color }} strokeWidth={2.1} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold text-slate-800">{label}</p>
                <p className="text-[11.5px] text-slate-400">{sub}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
            </Link>
          ))}
        </div>
      </section>

    </div>
  )
}
