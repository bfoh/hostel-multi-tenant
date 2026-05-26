import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Inbox } from 'lucide-react'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { SelfCheckinConfirmPanel } from '@/components/bookings/self-checkin-confirm-panel'
import { formatGHS } from '@/lib/utils'

export const metadata: Metadata = { title: 'Self Check-ins' }
export const dynamic = 'force-dynamic'

type PendingRow = {
  id: string
  booking_ref: string
  payment_status: string
  total_amount: number
  check_in_date: string
  check_out_date: string
  self_checkin_submitted_at: string
  ghana_card_front_doc_id: string | null
  ghana_card_back_doc_id: string | null
  occupant: {
    id: string
    first_name: string
    last_name: string
    phone: string
    email: string | null
    institution: string | null
    student_id: string | null
  } | null
  room: {
    id: string
    room_number: string
    category: { name: string } | null
  } | null
  front_url: string | null
  back_url: string | null
}

export default async function SelfCheckinsPage() {
  const tenantId = await getServerTenantId()
  if (!tenantId) return null

  const admin = await createTenantAdminClientFromHeaders()

  const { data: rawBookings } = await admin
    .from('bookings')
    .select(`
      id, booking_ref, payment_status, total_amount, check_in_date, check_out_date,
      self_checkin_submitted_at, ghana_card_front_doc_id, ghana_card_back_doc_id,
      occupant:occupants(id, first_name, last_name, phone, email, institution, student_id),
      room:rooms(id, room_number, category:room_categories(name))
    `)
    .eq('tenant_id', tenantId)
    .not('self_checkin_submitted_at', 'is', null)
    .is('self_checkin_confirmed_at', null)
    .order('self_checkin_submitted_at', { ascending: false })

  // Fetch document URLs in bulk
  const docIds = Array.from(new Set(
    (rawBookings ?? [])
      .flatMap((b: any) => [b.ghana_card_front_doc_id, b.ghana_card_back_doc_id])
      .filter((v: unknown): v is string => typeof v === 'string'),
  ))

  const docUrlMap = new Map<string, string>()
  if (docIds.length) {
    const { data: docs } = await (admin.from('occupant_documents') as any)
      .select('id, file_url')
      .in('id', docIds)
    for (const d of (docs ?? []) as { id: string; file_url: string }[]) {
      docUrlMap.set(d.id, d.file_url)
    }
  }

  const bookings: PendingRow[] = ((rawBookings ?? []) as any[]).map((b) => {
    const occupant = Array.isArray(b.occupant) ? b.occupant[0] : b.occupant
    const room     = Array.isArray(b.room)     ? b.room[0]     : b.room
    const category = room?.category
      ? Array.isArray(room.category) ? room.category[0] : room.category
      : null
    return {
      id: b.id,
      booking_ref: b.booking_ref,
      payment_status: b.payment_status,
      total_amount: b.total_amount,
      check_in_date: b.check_in_date,
      check_out_date: b.check_out_date,
      self_checkin_submitted_at: b.self_checkin_submitted_at,
      ghana_card_front_doc_id: b.ghana_card_front_doc_id,
      ghana_card_back_doc_id: b.ghana_card_back_doc_id,
      occupant: occupant ? {
        id: occupant.id,
        first_name: occupant.first_name,
        last_name: occupant.last_name,
        phone: occupant.phone,
        email: occupant.email,
        institution: occupant.institution,
        student_id: occupant.student_id,
      } : null,
      room: room ? {
        id: room.id,
        room_number: room.room_number,
        category: category ? { name: category.name } : null,
      } : null,
      front_url: b.ghana_card_front_doc_id ? docUrlMap.get(b.ghana_card_front_doc_id) ?? null : null,
      back_url:  b.ghana_card_back_doc_id  ? docUrlMap.get(b.ghana_card_back_doc_id)  ?? null : null,
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/bookings"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Bookings
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-text-primary">Self Check-ins</h1>
        <p className="mt-0.5 text-sm text-text-secondary">
          {bookings.length} pending confirmation{bookings.length !== 1 ? 's' : ''}. Verify each Ghana Card before confirming.
        </p>
      </div>

      {bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <Inbox className="h-10 w-10 text-text-disabled" />
          <p className="font-medium text-text-primary">No pending self check-ins</p>
          <p className="text-sm text-text-secondary">New submissions will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => (
            <article
              key={b.id}
              className="rounded-xl border border-border bg-surface p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="ref-number text-xs text-text-tertiary">{b.booking_ref}</p>
                  <h3 className="mt-0.5 text-base font-bold text-text-primary">
                    {b.occupant ? `${b.occupant.first_name} ${b.occupant.last_name}` : 'Unknown'}
                  </h3>
                  <p className="text-xs text-text-secondary">
                    {b.occupant?.phone}
                    {b.occupant?.institution ? ` · ${b.occupant.institution}` : ''}
                    {b.occupant?.student_id ? ` · ${b.occupant.student_id}` : ''}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${
                    b.payment_status === 'paid'
                      ? 'bg-success-subtle text-success border-success/20'
                      : 'bg-warning-subtle text-warning-fg border-warning/20'
                  }`}
                >
                  {b.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                <div>
                  <p className="text-text-tertiary">Room</p>
                  <p className="font-medium text-text-primary">
                    {b.room?.room_number ?? '—'}
                    {b.room?.category ? ` · ${b.room.category.name}` : ''}
                  </p>
                </div>
                <div>
                  <p className="text-text-tertiary">Check-in</p>
                  <p className="font-medium text-text-primary">{b.check_in_date}</p>
                </div>
                <div>
                  <p className="text-text-tertiary">Check-out</p>
                  <p className="font-medium text-text-primary">{b.check_out_date}</p>
                </div>
                <div>
                  <p className="text-text-tertiary">Total</p>
                  <p className="font-medium text-text-primary">{formatGHS(b.total_amount)}</p>
                </div>
              </div>

              {(b.front_url || b.back_url) && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium text-text-secondary">Ghana Card</p>
                  <div className="grid grid-cols-2 gap-3">
                    {b.front_url && (
                      <a href={b.front_url} target="_blank" rel="noreferrer" className="block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={b.front_url}
                          alt="Ghana Card front"
                          className="h-32 w-full rounded-lg border border-border object-cover"
                        />
                        <p className="mt-1 text-center text-[11px] text-text-tertiary">Front</p>
                      </a>
                    )}
                    {b.back_url && (
                      <a href={b.back_url} target="_blank" rel="noreferrer" className="block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={b.back_url}
                          alt="Ghana Card back"
                          className="h-32 w-full rounded-lg border border-border object-cover"
                        />
                        <p className="mt-1 text-center text-[11px] text-text-tertiary">Back</p>
                      </a>
                    )}
                  </div>
                </div>
              )}

              <SelfCheckinConfirmPanel bookingId={b.id} bookingRef={b.booking_ref} />
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
