import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOccupantSession } from '@/lib/auth/occupant-session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Wrench, Plus, CheckCircle2, Clock, AlertCircle,
  Zap, Droplets, Wind, Building2, Sofa, Cpu, Sparkles, Shield, Bug, MoreHorizontal,
} from 'lucide-react'

export const metadata: Metadata = { title: 'Maintenance · My Portal' }

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const mins  = Math.floor(diff / 60000)
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs  < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

const CATEGORY_ICON: Record<string, React.ElementType> = {
  plumbing:    Droplets,
  electrical:  Zap,
  hvac:        Wind,
  structural:  Building2,
  furniture:   Sofa,
  appliance:   Cpu,
  cleaning:    Sparkles,
  pest_control: Bug,
  security:    Shield,
  other:       MoreHorizontal,
}

const CATEGORY_LABEL: Record<string, string> = {
  plumbing:    'Plumbing',
  electrical:  'Electrical',
  hvac:        'HVAC / AC',
  structural:  'Structural',
  furniture:   'Furniture',
  appliance:   'Appliance',
  cleaning:    'Cleaning',
  pest_control: 'Pest Control',
  security:    'Security',
  other:       'Other',
}

const STATUS_CONFIG: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
  open:        { label: 'Open',        cls: 'bg-amber-50 text-amber-700 border-amber-200',     Icon: Clock        },
  in_progress: { label: 'In Progress', cls: 'bg-blue-50 text-blue-700 border-blue-200',        Icon: Wrench       },
  completed:   { label: 'Completed',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2 },
  cancelled:   { label: 'Cancelled',   cls: 'bg-slate-50 text-slate-500 border-slate-200',     Icon: AlertCircle  },
}

const PRIORITY_CLS: Record<string, string> = {
  low:    'bg-slate-100 text-slate-500',
  medium: 'bg-blue-50 text-blue-600',
  high:   'bg-orange-50 text-orange-600',
  urgent: 'bg-red-50 text-red-600',
}

export default async function MaintenancePage() {
  const session = await getOccupantSession()
  if (!session) redirect('/occupant-portal')

  const { occupantId, tenantId, tenantColor: color } = session
  const admin = createAdminClient()

  // Get active booking + room (confirmed or checked_in)
  const { data: booking } = await admin
    .from('bookings')
    .select('id, booking_ref, room_id, rooms(room_number, block)')
    .eq('occupant_id', occupantId)
    .eq('tenant_id', tenantId)
    .in('status', ['checked_in', 'confirmed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const room = booking ? (Array.isArray(booking.rooms) ? booking.rooms[0] : booking.rooms) as any : null

  // Fetch maintenance requests for this room
  const { data: requestsRaw } = booking?.room_id ? await admin
    .from('maintenance_requests')
    .select('id, title, category, priority, status, description, created_at, resolved_at')
    .eq('tenant_id', tenantId)
    .eq('room_id', booking.room_id)
    .order('created_at', { ascending: false })
    .limit(50) : { data: [] }

  const requests = requestsRaw ?? []
  const open        = requests.filter(r => r.status === 'open').length
  const in_progress = requests.filter(r => r.status === 'in_progress').length
  const resolved    = requests.filter(r => r.status === 'completed' || r.status === 'cancelled').length

  return (
    <div className="space-y-4">

      {/* ── Header + New request CTA ─────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Maintenance</h1>
          {room && (
            <p className="text-xs text-slate-500">Room {room.room_number}{room.block ? ` · ${room.block}` : ''}</p>
          )}
        </div>
        {booking && (
          <Link
            href="/occupant-portal/maintenance/new"
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ backgroundColor: color }}
          >
            <Plus className="h-4 w-4" /> New request
          </Link>
        )}
      </div>

      {/* ── Stats row ────────────────────────────────────────────── */}
      {requests.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: 'Open', value: open,        cls: 'text-amber-600'  },
            { label: 'In Progress', value: in_progress, cls: 'text-blue-600'   },
            { label: 'Resolved', value: resolved,    cls: 'text-emerald-600' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-center shadow-sm">
              <p className={`text-xl font-bold ${s.cls}`}>{s.value}</p>
              <p className="mt-0.5 text-[10px] text-slate-400 uppercase tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── No booking state ─────────────────────────────────────── */}
      {!booking && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <Wrench className="mx-auto h-8 w-8 text-slate-300 mb-2" />
          <p className="text-sm font-medium text-slate-500">No active booking</p>
          <p className="text-xs text-slate-400 mt-0.5">Maintenance requests are linked to your room.</p>
        </div>
      )}

      {/* ── Request list ─────────────────────────────────────────── */}
      {booking && requests.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-slate-300 mb-2" />
          <p className="text-sm font-medium text-slate-500">No maintenance requests yet</p>
          <p className="text-xs text-slate-400 mt-0.5">Everything working? Great! Tap &quot;New request&quot; if something needs attention.</p>
        </div>
      )}

      {requests.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-800">Your Requests</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {requests.map(r => {
              const Icon   = CATEGORY_ICON[r.category] ?? MoreHorizontal
              const status = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.open
              const StatusIcon = status.Icon
              return (
                <Link key={r.id} href={`/occupant-portal/maintenance/${r.id}`} className="block px-5 py-4 hover:bg-slate-50">
                  <div className="flex items-start gap-3">
                    <div
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${color}15` }}
                    >
                      <Icon className="h-4 w-4" style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-800 leading-snug">{r.title}</p>
                        <span className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${status.cls}`}>
                          <StatusIcon className="h-2.5 w-2.5" />
                          {status.label}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                        <span className="rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-500">
                          {CATEGORY_LABEL[r.category] ?? r.category}
                        </span>
                        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase ${PRIORITY_CLS[r.priority]}`}>
                          {r.priority}
                        </span>
                        <span className="text-[10px] text-slate-400">{timeAgo(r.created_at)}</span>
                      </div>
                      {r.description && (
                        <p className="mt-2 text-xs text-slate-500 leading-relaxed line-clamp-2">{r.description}</p>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

    </div>
  )
}
