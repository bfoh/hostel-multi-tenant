import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Pencil, BedDouble } from 'lucide-react'

import { getRoomById } from '@/lib/data/rooms'
import { createClient } from '@/lib/supabase/server'
import { formatGHS, formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RoomStatusActions } from '@/components/rooms/room-status-actions'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const room = await getRoomById(id)
  return { title: room ? `Room ${room.room_number}` : 'Room not found' }
}

async function getRoomBookings(roomId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('bookings')
    .select(`
      id, booking_ref, status, payment_status, check_in_date, check_out_date,
      final_amount, paid_amount, source,
      occupant:occupants(first_name, last_name, phone, institution)
    `)
    .eq('room_id', roomId)
    .order('check_in_date', { ascending: false })
    .limit(10)

  return data ?? []
}

const STATUS_STYLES: Record<string, string> = {
  pending_payment: 'bg-warning-subtle text-warning-fg border-warning/20',
  confirmed:       'bg-brand-subtle text-brand border-brand/20',
  checked_in:      'bg-success-subtle text-success border-success/20',
  checked_out:     'bg-surface-sunken text-text-secondary border-border',
  cancelled:       'bg-danger-subtle text-danger border-danger/20',
}

export default async function RoomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [room, bookings] = await Promise.all([getRoomById(id), getRoomBookings(id)])

  if (!room) notFound()

  const category = Array.isArray(room.category) ? room.category[0] : room.category

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb + actions ─────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link
            href="/rooms"
            className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Rooms
          </Link>
          <h1 className="text-2xl font-bold text-text-primary">Room {room.room_number}</h1>
          {(room.block || room.floor != null) && (
            <p className="text-sm text-text-secondary">
              {[room.block && `Block ${room.block}`, room.floor != null && `Floor ${room.floor}`]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>
        <Link
          href={`/rooms/${id}/edit`}
          className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface-raised transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Room details ─────────────────────────────────────── */}
        <div className="space-y-4 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Room Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <Row label="Status">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${
                    room.status === 'available' ? 'bg-success-subtle text-success border-success/20'
                    : room.status === 'occupied' ? 'bg-brand-subtle text-brand border-brand/20'
                    : room.status === 'maintenance' ? 'bg-danger-subtle text-danger border-danger/20'
                    : 'bg-surface-sunken text-text-secondary border-border'
                  }`}
                >
                  {room.status}
                </span>
              </Row>
              {category && (
                <>
                  <Row label="Type">{category.name}</Row>
                  <Row label="Capacity">{category.capacity} person{category.capacity !== 1 ? 's' : ''}</Row>
                  <Row label="Rate">
                    <span className="currency-amount">
                      {formatGHS(category.base_rate)}/{category.rate_unit}
                    </span>
                  </Row>
                </>
              )}
              {room.floor != null && <Row label="Floor">{room.floor}</Row>}
              {room.block && <Row label="Block">{room.block}</Row>}
              <Row label="Housekeeping">
                <span className={`capitalize ${
                  room.housekeeping_status === 'clean' ? 'text-success'
                  : room.housekeeping_status === 'dirty' ? 'text-warning'
                  : 'text-text-secondary'
                }`}>
                  {room.housekeeping_status.replace('_', ' ')}
                </span>
              </Row>
              {room.last_cleaned_at && (
                <Row label="Last cleaned">{formatDate(room.last_cleaned_at)}</Row>
              )}
              {room.notes && (
                <div>
                  <p className="text-xs text-text-tertiary">Notes</p>
                  <p className="mt-0.5 text-sm text-text-primary">{room.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick status actions */}
          <RoomStatusActions roomId={id} currentStatus={room.status} />

          {/* Amenities */}
          {category?.amenities && category.amenities.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Amenities</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-1.5">
                  {category.amenities.map((a: string) => (
                    <span
                      key={a}
                      className="rounded-full bg-surface-sunken px-2.5 py-0.5 text-xs text-text-secondary"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Booking history ──────────────────────────────────── */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Booking History</CardTitle>
              <Link
                href={`/bookings/new?room=${id}`}
                className="text-xs font-medium text-brand hover:text-brand-hover transition-colors"
              >
                + New booking
              </Link>
            </CardHeader>
            <CardContent className="pt-0">
              {bookings.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <BedDouble className="h-8 w-8 text-text-disabled" />
                  <p className="text-sm text-text-secondary">No bookings for this room yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {bookings.map((b) => {
                    const occupant = Array.isArray(b.occupant) ? b.occupant[0] : b.occupant
                    return (
                      <Link
                        key={b.id}
                        href={`/bookings/${b.id}`}
                        className="flex items-center gap-4 py-3 hover:bg-surface-raised rounded-lg px-2 -mx-2 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="ref-number text-xs text-text-tertiary">{b.booking_ref}</p>
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                                STATUS_STYLES[b.status] ?? 'bg-surface-sunken text-text-secondary border-border'
                              }`}
                            >
                              {b.status.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="mt-0.5 text-sm font-medium text-text-primary">
                            {occupant?.first_name} {occupant?.last_name}
                          </p>
                          <p className="text-xs text-text-tertiary">
                            {b.check_in_date} → {b.check_out_date ?? 'ongoing'}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="currency-amount text-sm font-medium text-text-primary">
                            {formatGHS(b.final_amount)}
                          </p>
                          <p className={`text-xs ${b.payment_status === 'paid' ? 'text-success' : 'text-warning'}`}>
                            {b.payment_status}
                          </p>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <p className="shrink-0 text-xs text-text-tertiary">{label}</p>
      <div className="text-right text-sm text-text-primary">{children}</div>
    </div>
  )
}
