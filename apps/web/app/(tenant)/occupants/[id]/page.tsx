import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Pencil, Phone, Mail, GraduationCap, MapPin } from 'lucide-react'

import { getOccupantById } from '@/lib/data/occupants'
import { formatGHS, formatDate, initials } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const o = await getOccupantById(id)
  return { title: o ? `${o.first_name} ${o.last_name}` : 'Occupant not found' }
}

const STATUS_STYLES: Record<string, string> = {
  pending_payment: 'bg-warning-subtle text-warning-fg border-warning/20',
  confirmed:       'bg-brand-subtle text-brand border-brand/20',
  checked_in:      'bg-success-subtle text-success border-success/20',
  checked_out:     'bg-surface-sunken text-text-secondary border-border',
  cancelled:       'bg-danger-subtle text-danger border-danger/20',
}

export default async function OccupantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const occupant = await getOccupantById(id)

  if (!occupant) notFound()

  const bookings = Array.isArray(occupant.bookings) ? occupant.bookings : []
  const activeBooking = bookings.find((b) => b.status === 'checked_in')

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link
            href="/occupants"
            className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Occupants
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-subtle text-base font-semibold text-brand">
              {occupant.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={occupant.photo_url} alt="" className="h-12 w-12 rounded-full object-cover" />
              ) : (
                initials(`${occupant.first_name} ${occupant.last_name}`)
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">
                {occupant.first_name} {occupant.other_names ? occupant.other_names + ' ' : ''}{occupant.last_name}
              </h1>
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${
                  occupant.status === 'active' ? 'bg-success-subtle text-success border-success/20'
                  : occupant.status === 'blacklisted' ? 'bg-danger-subtle text-danger border-danger/20'
                  : 'bg-surface-sunken text-text-secondary border-border'
                }`}
              >
                {occupant.status}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/bookings/new?occupant=${id}`}
            className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
          >
            New booking
          </Link>
          <Link
            href={`/occupants/${id}/edit`}
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface-raised transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Profile ──────────────────────────────────────────── */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 shrink-0 text-text-disabled" />
                <a href={`tel:${occupant.phone}`} className="text-text-primary hover:text-brand transition-colors">
                  {occupant.phone}
                </a>
              </div>
              {occupant.alternate_phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 shrink-0 text-text-disabled" />
                  <a href={`tel:${occupant.alternate_phone}`} className="text-text-secondary">
                    {occupant.alternate_phone}
                  </a>
                </div>
              )}
              {occupant.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 shrink-0 text-text-disabled" />
                  <a href={`mailto:${occupant.email}`} className="text-text-primary hover:text-brand transition-colors truncate">
                    {occupant.email}
                  </a>
                </div>
              )}
              {occupant.home_address && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 shrink-0 text-text-disabled mt-0.5" />
                  <span className="text-text-secondary">{occupant.home_address}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {(occupant.institution || occupant.student_id) && (
            <Card>
              <CardHeader><CardTitle>Academic Info</CardTitle></CardHeader>
              <CardContent className="space-y-3 pt-0">
                {occupant.institution && (
                  <div className="flex items-center gap-2 text-sm">
                    <GraduationCap className="h-4 w-4 shrink-0 text-text-disabled" />
                    <span className="text-text-primary">{occupant.institution}</span>
                  </div>
                )}
                {occupant.student_id && <Row label="Student ID"><span className="ref-number">{occupant.student_id}</span></Row>}
                {occupant.programme && <Row label="Programme">{occupant.programme}</Row>}
                {occupant.year_of_study && <Row label="Year">Year {occupant.year_of_study}</Row>}
                {occupant.semester && <Row label="Semester" className="capitalize">{occupant.semester}</Row>}
              </CardContent>
            </Card>
          )}

          {occupant.emergency_contact && (
            <Card>
              <CardHeader><CardTitle>Emergency Contact</CardTitle></CardHeader>
              <CardContent className="space-y-2 pt-0 text-sm">
                {typeof occupant.emergency_contact === 'object' && occupant.emergency_contact !== null && (
                  <>
                    {(occupant.emergency_contact as Record<string, string>).name && (
                      <Row label="Name">{(occupant.emergency_contact as Record<string, string>).name}</Row>
                    )}
                    {(occupant.emergency_contact as Record<string, string>).relationship && (
                      <Row label="Relation">{(occupant.emergency_contact as Record<string, string>).relationship}</Row>
                    )}
                    {(occupant.emergency_contact as Record<string, string>).phone && (
                      <Row label="Phone">
                        <a href={`tel:${(occupant.emergency_contact as Record<string, string>).phone}`} className="text-brand">
                          {(occupant.emergency_contact as Record<string, string>).phone}
                        </a>
                      </Row>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {occupant.notes && (
            <Card>
              <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-text-secondary">{occupant.notes}</p>
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
                href={`/bookings/new?occupant=${id}`}
                className="text-xs font-medium text-brand hover:text-brand-hover transition-colors"
              >
                + New booking
              </Link>
            </CardHeader>
            <CardContent className="pt-0">
              {bookings.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10">
                  <p className="text-sm text-text-secondary">No bookings yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {bookings.map((b) => {
                    const room = Array.isArray(b.room) ? b.room[0] : b.room
                    const category = room?.category
                      ? Array.isArray(room.category) ? room.category[0] : room.category
                      : null
                    return (
                      <Link
                        key={b.id}
                        href={`/bookings/${b.id}`}
                        className="flex items-center gap-4 py-3 hover:bg-surface-raised rounded-lg px-2 -mx-2 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="ref-number text-xs text-text-tertiary">{b.booking_ref}</p>
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                                STATUS_STYLES[b.status] ?? 'bg-surface-sunken text-text-secondary border-border'
                              }`}
                            >
                              {b.status.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="mt-0.5 text-sm text-text-primary">
                            {room ? `Room ${room.room_number}` : '—'}
                            {category ? ` — ${category.name}` : ''}
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
                            Paid {formatGHS(b.paid_amount)}
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

function Row({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <p className="shrink-0 text-xs text-text-tertiary">{label}</p>
      <div className={`text-right text-sm text-text-primary ${className ?? ''}`}>{children}</div>
    </div>
  )
}
