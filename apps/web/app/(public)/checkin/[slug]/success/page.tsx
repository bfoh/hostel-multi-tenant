import { CheckCircle2 } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function SelfCheckinSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ ref?: string; reference?: string }>
}) {
  const { slug } = await params
  const { ref, reference } = await searchParams

  const admin = createAdminClient()
  const { data: tenant } = await admin
    .from('tenants')
    .select('name, contact_phone')
    .eq('slug', slug)
    .maybeSingle()

  // Paystack returns ?reference= ; we lookup the booking by it
  let bookingRef = ref ?? null
  let paymentStatus: 'paid' | 'unpaid' | 'pending' = 'pending'

  if (!bookingRef && reference) {
    const { data: payment } = await admin
      .from('booking_payments')
      .select('booking_id, status, bookings(booking_ref, payment_status)')
      .eq('reference', reference)
      .maybeSingle()
    const booking = payment?.bookings
      ? Array.isArray(payment.bookings) ? payment.bookings[0] : payment.bookings
      : null
    if (booking) {
      bookingRef = booking.booking_ref as string
      paymentStatus = (booking.payment_status as 'paid' | 'unpaid' | 'pending') ?? 'pending'
    }
  } else if (bookingRef) {
    const { data: booking } = await admin
      .from('bookings')
      .select('payment_status')
      .eq('booking_ref', bookingRef)
      .maybeSingle()
    paymentStatus = (booking?.payment_status as 'paid' | 'unpaid' | 'pending') ?? 'pending'
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] px-4 py-10">
      <div className="mx-auto max-w-md text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-success" />
        <h1 className="mt-4 text-xl font-bold text-text-primary">
          {paymentStatus === 'paid' ? 'Payment received' : 'Submission received'}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Show this code to the front desk to complete check-in at {tenant?.name ?? 'the hostel'}.
        </p>

        <div className="mt-6 rounded-xl border border-border bg-surface p-6">
          <p className="text-xs text-text-tertiary">Booking code</p>
          <p className="ref-number mt-1 text-2xl font-bold tracking-wider text-text-primary">
            {bookingRef ?? '—'}
          </p>
          <p className="mt-3 text-xs">
            Status:{' '}
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                paymentStatus === 'paid'
                  ? 'bg-success-subtle text-success'
                  : 'bg-warning-subtle text-warning-fg'
              }`}
            >
              {paymentStatus === 'paid' ? 'Paid' : 'Awaiting payment'}
            </span>
          </p>
        </div>

        <p className="mt-6 text-xs text-text-tertiary">
          Staff will verify your Ghana Card and assign your room.
          {tenant?.contact_phone && (
            <>
              {' '}Need help?{' '}
              <a href={`tel:${tenant.contact_phone}`} className="font-medium text-brand">
                Call {tenant.contact_phone}
              </a>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
