import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOccupantSession } from '@/lib/auth/occupant-session'
import { redirect } from 'next/navigation'
import { BedDouble, Shield, Settings } from 'lucide-react'
import { ProfileForm } from '@/components/occupant-portal/profile-form'
import { SettingsActions } from '@/components/occupant-portal/settings-actions'

export const metadata: Metadata = { title: 'Profile · My Portal' }

function date(d: string) {
  return new Intl.DateTimeFormat('en-GH', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d))
}

const STATUS_CLS: Record<string, string> = {
  pending_payment: 'text-amber-600',
  confirmed:       'text-blue-600',
  checked_in:      'text-emerald-600',
  checked_out:     'text-slate-500',
  cancelled:       'text-red-500',
}
const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Pending payment',
  confirmed:       'Confirmed',
  checked_in:      'Checked in',
  checked_out:     'Checked out',
  cancelled:       'Cancelled',
}

export default async function ProfilePage() {
  const session = await getOccupantSession()
  if (!session) redirect('/occupant-portal')

  const { userId, occupantId, tenantId, tenantColor: color } = session
  const admin = createAdminClient()

  const [{ data: occupant }, { data: tenant }, { data: bookingsRaw }] = await Promise.all([
    admin
      .from('occupants')
      .select('id, first_name, last_name, phone, email, student_id, institution, programme, created_at')
      .eq('id', occupantId)
      .single(),
    admin
      .from('tenants')
      .select('name, contact_phone, contact_email')
      .eq('id', tenantId)
      .single(),
    admin
      .from('bookings')
      .select('id, booking_ref, status, check_in_date, check_out_date, rooms(room_number, block)')
      .eq('occupant_id', occupantId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  if (!occupant) redirect('/occupant-portal')

  const bookings = bookingsRaw ?? []

  return (
    <div className="space-y-4">

      {/* ── Avatar + name header ─────────────────────────────────── */}
      <div className="flex flex-col items-center gap-3 py-4">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white shadow-md"
          style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}bb 100%)` }}
        >
          {occupant.first_name[0]?.toUpperCase()}{occupant.last_name[0]?.toUpperCase()}
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-800">{occupant.first_name} {occupant.last_name}</h1>
          <p className="text-sm text-slate-500">{occupant.email}</p>
          {occupant.student_id && (
            <p className="mt-0.5 font-mono text-xs text-slate-400">{occupant.student_id}</p>
          )}
        </div>
      </div>

      {/* ── Profile form (editable) ──────────────────────────────── */}
      <ProfileForm
        initial={{
          first_name:  occupant.first_name,
          last_name:   occupant.last_name,
          phone:       occupant.phone,
          institution: occupant.institution ?? null,
          programme:   occupant.programme ?? null,
          student_id:  occupant.student_id ?? null,
        }}
        color={color}
      />

      {/* ── Booking history ──────────────────────────────────────── */}
      {bookings.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
            <BedDouble className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-800">Booking History</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {bookings.map(b => {
              const room = (Array.isArray(b.rooms) ? b.rooms[0] : b.rooms) as any
              return (
                <div key={b.id} className="flex items-start justify-between px-5 py-3.5">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      Room {room?.room_number ?? '—'}{room?.block ? ` · ${room.block}` : ''}
                    </p>
                    <p className="font-mono text-[11px] text-slate-400">{b.booking_ref}</p>
                    {b.check_in_date && (
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {date(b.check_in_date)}
                        {b.check_out_date ? ` → ${date(b.check_out_date)}` : ' → ongoing'}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs font-semibold ${STATUS_CLS[b.status] ?? 'text-slate-500'}`}>
                    {STATUS_LABEL[b.status] ?? b.status}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Account info ─────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
          <Shield className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-800">Account</h2>
        </div>
        <div className="divide-y divide-slate-100">
          <div className="flex items-center justify-between px-5 py-3.5">
            <p className="text-xs text-slate-400">Email</p>
            <p className="text-sm font-medium text-slate-800">{occupant.email}</p>
          </div>
          <div className="flex items-center justify-between px-5 py-3.5">
            <p className="text-xs text-slate-400">Member since</p>
            <p className="text-sm font-medium text-slate-800">{date(occupant.created_at)}</p>
          </div>
        </div>
      </section>

      {/* ── Settings ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 pt-1">
        <Settings className="h-4 w-4 text-slate-400" />
        <h2 className="text-sm font-semibold text-slate-600">Settings</h2>
      </div>

      <SettingsActions
        color={color}
        supportPhone={tenant?.contact_phone ?? null}
        supportEmail={tenant?.contact_email ?? null}
        hostelName={tenant?.name ?? 'My Hostel'}
      />

      {/* ── Sign out ─────────────────────────────────────────────── */}
      <form action="/api/auth/signout" method="POST">
        <button
          type="submit"
          className="w-full rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100"
        >
          Sign out
        </button>
      </form>

      <p className="pb-2 text-center text-[10px] text-slate-300">
        v1.0 · Powered by HMS
      </p>

    </div>
  )
}
