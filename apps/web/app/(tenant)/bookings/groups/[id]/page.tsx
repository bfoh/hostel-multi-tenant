import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { getServerBusinessType } from '@/lib/auth/tenant'
import { getAvailableRooms } from '@/lib/data/bookings'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  RemoveRoomButton, BillingContactForm, AddRoomForm, CancelGroupButton,
} from '@/components/bookings/group-manage-actions'

export const metadata: Metadata = { title: 'Group Booking' }
export const dynamic = 'force-dynamic'

const STATUS_BADGE: Record<string, string> = {
  pending_payment: 'bg-warning-subtle text-warning-fg border-warning/20',
  confirmed:       'bg-brand-subtle text-brand border-brand/20',
  checked_in:      'bg-success-subtle text-success border-success/20',
  checked_out:     'bg-surface-sunken text-text-secondary border-border',
  cancelled:       'bg-danger-subtle text-danger border-danger/20',
}

export default async function GroupBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const isHotel = (await getServerBusinessType()) === 'hotel'
  if (!isHotel) notFound()

  const { id } = await params
  const supabase = await createTenantAdminClientFromHeaders()

  const { data: group } = await supabase
    .from('booking_groups')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!group) notFound()

  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      id, booking_ref, status, check_in_date, check_out_date, total_amount, final_amount, paid_amount,
      occupant:occupants(id, first_name, last_name, phone),
      room:rooms(id, room_number, block)
    `)
    .eq('group_id', id)
    .order('created_at', { ascending: true })

  const members = bookings ?? []
  const firstMember = members[0]

  // Room/occupant options for the "add a room" panel, scoped to the
  // group's own stay dates (all members share the same check-in/out).
  const tenantId = firstMember ? await getServerTenantId() : null
  const [availableRooms, occupantsRes] = firstMember
    ? await Promise.all([
        getAvailableRooms(firstMember.check_in_date, firstMember.check_out_date),
        tenantId
          ? createAdminClient()
              .from('occupants')
              .select('id, first_name, last_name, phone')
              .eq('tenant_id', tenantId)
              .neq('status', 'blacklisted')
              .order('first_name')
              .limit(500)
          : Promise.resolve({ data: [] }),
      ])
    : [[], { data: [] }]

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <Link href="/bookings" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft className="h-4 w-4" />
          Bookings
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="font-display text-xl font-bold text-text-primary ref-number">{group.group_ref}</h1>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${group.status === 'active' ? 'bg-success-subtle text-success border-success/20' : 'bg-surface-sunken text-text-secondary border-border'}`}>
            {group.status}
          </span>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Rooms ({members.length})</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <div className="divide-y divide-border">
            {members.map((m) => {
              const occupant = Array.isArray(m.occupant) ? m.occupant[0] : m.occupant
              const room = Array.isArray(m.room) ? m.room[0] : m.room
              return (
                <div key={m.id} className="flex items-center justify-between py-3">
                  <div>
                    <Link href={`/bookings/${m.id}`} className="font-medium text-text-primary hover:text-brand transition-colors">
                      Room {room?.room_number ?? '—'}{room?.block ? ` · Block ${room.block}` : ''}
                    </Link>
                    <p className="text-xs text-text-tertiary">
                      {occupant ? `${occupant.first_name} ${occupant.last_name}` : 'No guest'} · {m.booking_ref}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE[m.status] ?? 'bg-surface-sunken text-text-secondary border-border'}`}>
                      {m.status.replace('_', ' ')}
                    </span>
                    <RemoveRoomButton groupId={id} bookingId={m.id} status={m.status} />
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Billing Contact</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <BillingContactForm
            groupId={id}
            initial={{
              name:  group.billing_contact_name,
              email: group.billing_contact_email,
              phone: group.billing_contact_phone,
            }}
          />
        </CardContent>
      </Card>

      {group.status === 'active' && firstMember && (
        <Card>
          <CardHeader><CardTitle>Add a Room</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <AddRoomForm
              groupId={id}
              rooms={availableRooms.filter((r: any) => !members.some((m) => {
                const room = Array.isArray(m.room) ? m.room[0] : m.room
                return room?.id === r.id
              })) as any}
              occupants={occupantsRes.data ?? []}
              checkIn={firstMember.check_in_date}
              checkOut={firstMember.check_out_date}
            />
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <a
          href={`/api/bookings/group/${id}/invoice`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-sunken transition-colors"
        >
          Download group invoice
        </a>
        {group.status === 'active' && (
          <CancelGroupButton groupId={id} hasCheckedIn={members.some((m) => m.status === 'checked_in')} />
        )}
      </div>
    </div>
  )
}
