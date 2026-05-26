import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

import { getBookingById } from '@/lib/data/bookings'
import { formatGHS, formatDate, initials } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BookingActions } from '@/components/bookings/booking-actions'
import { RecordPaymentForm } from '@/components/bookings/record-payment-form'
import { PaymentPlanCard } from '@/components/bookings/payment-plan-card'
import { InvoicePdfButton } from '@/components/bookings/invoice-pdf-button'
import { LeasePdfButton } from '@/components/bookings/lease-pdf-button'
import { RoomTransferButton } from '@/components/bookings/room-transfer-button'
import { DepositCard } from '@/components/bookings/deposit-card'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { getServerTenantId } from '@/lib/auth/tenant'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const b = await getBookingById(id)
  return { title: b ? `Booking ${b.booking_ref}` : 'Booking not found' }
}

const STATUS_BADGE: Record<string, string> = {
  pending_payment: 'bg-warning-subtle text-warning-fg border-warning/20',
  confirmed:       'bg-brand-subtle text-brand border-brand/20',
  checked_in:      'bg-success-subtle text-success border-success/20',
  checked_out:     'bg-surface-sunken text-text-secondary border-border',
  cancelled:       'bg-danger-subtle text-danger border-danger/20',
  no_show:         'bg-danger-subtle text-danger border-danger/20',
}

const PAYMENT_METHODS: Record<string, string> = {
  momo_mtn:       'MTN MoMo',
  momo_vodafone:  'Vodafone Cash',
  momo_airteltigo:'AirtelTigo Money',
  card:           'Card',
  bank_transfer:  'Bank Transfer',
  cash:           'Cash',
  cheque:         'Cheque',
}

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const booking = await getBookingById(id)

  if (!booking) notFound()

  // Fetch payment plan (if any)
  const supabase = await createTenantAdminClientFromHeaders()
  const { data: paymentPlan } = await supabase
    .from('payment_plans')
    .select('*, payment_plan_installments(*)')
    .eq('booking_id', id)
    .maybeSingle()

  const { data: deposit } = await supabase
    .from('damage_deposits')
    .select('*')
    .eq('booking_id', id)
    .maybeSingle()

  // Paystack is only live when both the platform key AND the tenant's subaccount are set
  const tenantId = await getServerTenantId()
  const { data: tenantRow } = tenantId
    ? await supabase
        .from('tenants')
        .select('paystack_subaccount_code')
        .eq('id', tenantId)
        .single()
    : { data: null }
  const paystackReady =
    !!process.env.PAYSTACK_SECRET_KEY && !!tenantRow?.paystack_subaccount_code

  const occupant = Array.isArray(booking.occupant) ? booking.occupant[0] : booking.occupant
  const room = Array.isArray(booking.room) ? booking.room[0] : booking.room
  const category = room?.category ? (Array.isArray(room.category) ? room.category[0] : room.category) : null
  const payments = Array.isArray(booking.booking_payments) ? booking.booking_payments : []
  const successPayments = payments.filter((p) => p.status === 'success')
  const balance = booking.final_amount - booking.paid_amount

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link href="/bookings" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
            <ChevronLeft className="h-4 w-4" />
            Bookings
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-xl font-bold text-text-primary ref-number">
              {booking.booking_ref}
            </h1>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[booking.status] ?? 'bg-surface-sunken text-text-secondary border-border'}`}>
              {booking.status.replace('_', ' ')}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <InvoicePdfButton bookingId={id} />
          <LeasePdfButton bookingId={id} />
          <RoomTransferButton
            bookingId={id}
            currentRoomId={room?.id ?? ''}
            bookingStatus={booking.status}
          />
          <BookingActions bookingId={id} status={booking.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Left column ──────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Occupant */}
          <Card>
            <CardHeader><CardTitle>Occupant</CardTitle></CardHeader>
            <CardContent className="pt-0">
              {occupant ? (
                <Link href={`/occupants/${occupant.id}`} className="flex items-center gap-3 group">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-sm font-semibold text-brand">
                    {occupant.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={occupant.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      initials(`${occupant.first_name} ${occupant.last_name}`)
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-text-primary group-hover:text-brand transition-colors">
                      {occupant.first_name} {occupant.last_name}
                    </p>
                    <p className="text-xs text-text-tertiary">{occupant.phone ?? occupant.email}</p>
                    {occupant.student_id && (
                      <p className="ref-number text-[11px] text-text-disabled">{occupant.student_id}</p>
                    )}
                  </div>
                </Link>
              ) : (
                <p className="text-sm text-text-tertiary">No occupant linked</p>
              )}
            </CardContent>
          </Card>

          {/* Room */}
          <Card>
            <CardHeader><CardTitle>Room</CardTitle></CardHeader>
            <CardContent className="space-y-2 pt-0">
              {room ? (
                <Link href={`/rooms/${room.id}`} className="block group">
                  <p className="font-medium text-text-primary group-hover:text-brand transition-colors">
                    Room {room.room_number}
                    {room.block ? ` · Block ${room.block}` : ''}
                    {room.floor != null ? ` · Floor ${room.floor}` : ''}
                  </p>
                  {category && (
                    <p className="text-sm text-text-secondary">{category.name} · Capacity {category.capacity}</p>
                  )}
                </Link>
              ) : (
                <p className="text-sm text-text-tertiary">No room assigned</p>
              )}
            </CardContent>
          </Card>

          {/* Dates */}
          <Card>
            <CardHeader><CardTitle>Dates</CardTitle></CardHeader>
            <CardContent className="space-y-2 pt-0">
              <Row label="Check-in">{formatDate(booking.check_in_date)}</Row>
              <Row label="Check-out">{booking.check_out_date ? formatDate(booking.check_out_date) : '—'}</Row>
              {booking.semester && <Row label="Semester" className="capitalize">{booking.semester}</Row>}
              {booking.actual_check_in && <Row label="Actual check-in">{formatDate(booking.actual_check_in)}</Row>}
              {booking.actual_check_out && <Row label="Actual check-out">{formatDate(booking.actual_check_out)}</Row>}
              <Row label="Source"><span className="capitalize">{booking.source.replace('_', ' ')}</span></Row>
            </CardContent>
          </Card>
        </div>

        {/* ── Right column ─────────────────────────────────────── */}
        <div className="space-y-4 lg:col-span-2">
          {/* Financial summary */}
          <Card>
            <CardHeader><CardTitle>Financial Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3 pt-0">
              <Row label="Rate">
                <span className="currency-amount">
                  {formatGHS(booking.rate_per_unit)}/{booking.rate_unit}
                </span>
              </Row>
              <Row label="Subtotal"><span className="currency-amount">{formatGHS(booking.total_amount)}</span></Row>
              {booking.discount_amount > 0 && (
                <Row label={`Discount${booking.discount_reason ? ` (${booking.discount_reason})` : ''}`}>
                  <span className="currency-amount text-success">−{formatGHS(booking.discount_amount)}</span>
                </Row>
              )}
              {booking.tax_amount > 0 && (
                <Row label="Tax"><span className="currency-amount">{formatGHS(booking.tax_amount)}</span></Row>
              )}
              <div className="border-t border-border pt-3">
                <Row label="Total">
                  <span className="currency-amount font-bold text-text-primary text-base">{formatGHS(booking.final_amount)}</span>
                </Row>
                <Row label="Paid">
                  <span className="currency-amount text-success">{formatGHS(booking.paid_amount)}</span>
                </Row>
                {balance > 0 && (
                  <Row label="Balance due">
                    <span className="currency-amount font-semibold text-danger">{formatGHS(balance)}</span>
                  </Row>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Payment history */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Payments</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {successPayments.length === 0 ? (
                <p className="py-4 text-center text-sm text-text-tertiary">No payments recorded yet</p>
              ) : (
                <div className="divide-y divide-border">
                  {successPayments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {PAYMENT_METHODS[p.method] ?? p.method}
                        </p>
                        {p.reference && (
                          <p className="ref-number text-[11px] text-text-tertiary">{p.reference}</p>
                        )}
                        {p.paid_at && (
                          <p className="text-xs text-text-tertiary">{formatDate(p.paid_at)}</p>
                        )}
                      </div>
                      <p className="currency-amount text-sm font-semibold text-success">
                        +{formatGHS(p.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Record payment form (shown when balance > 0) */}
              {balance > 0 && booking.status !== 'cancelled' && (
                <div className="mt-4 border-t border-border pt-4">
                  <RecordPaymentForm
                    bookingId={id}
                    balance={balance}
                    paystackEnabled={paystackReady}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment plan */}
          <Card>
            <CardHeader><CardTitle>Payment Plan</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <PaymentPlanCard
                bookingId={id}
                balance={balance}
                initialPlan={paymentPlan as any}
                paystackEnabled={paystackReady}
              />
            </CardContent>
          </Card>

          {/* Damage deposit */}
          <Card>
            <CardHeader><CardTitle>Damage Deposit</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <DepositCard
                bookingId={id}
                occupantId={occupant?.id ?? ''}
                initialDeposit={deposit as any}
                paystackEnabled={paystackReady}
              />
            </CardContent>
          </Card>

          {/* Notes */}
          {booking.notes && (
            <Card>
              <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-text-secondary">{booking.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Cancellation info */}
          {booking.cancellation_reason && (
            <Card>
              <CardHeader><CardTitle>Cancellation</CardTitle></CardHeader>
              <CardContent className="space-y-2 pt-0">
                <Row label="Cancelled">{booking.cancelled_at ? formatDate(booking.cancelled_at) : '—'}</Row>
                <div>
                  <p className="text-xs text-text-tertiary">Reason</p>
                  <p className="mt-0.5 text-sm text-text-secondary">{booking.cancellation_reason}</p>
                </div>
              </CardContent>
            </Card>
          )}
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
