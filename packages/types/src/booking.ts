// ── Bookings & Reservations ───────────────────────────────────────────────────

export type BookingStatus =
  | 'enquiry'
  | 'pending_payment'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'no_show'

export type BookingSource = 'walk_in' | 'phone' | 'website' | 'widget' | 'voice_ai' | 'referral'

export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded' | 'disputed'

export type PaymentMethod =
  | 'momo_mtn'
  | 'momo_vodafone'
  | 'momo_airteltigo'
  | 'card'
  | 'bank_transfer'
  | 'cash'
  | 'cheque'

export interface Booking {
  id: string
  tenantId: string
  bookingRef: string            // Human-readable ref e.g. "ABR-2024-001847"
  occupantId: string
  roomId: string

  status: BookingStatus
  source: BookingSource

  checkInDate: string           // ISO date
  checkOutDate: string          // ISO date
  actualCheckIn: string | null  // ISO datetime (set on check-in)
  actualCheckOut: string | null // ISO datetime (set on check-out)

  // Pricing (all in pesewas — GHS × 100)
  ratePerUnit: number
  rateUnit: 'night' | 'week' | 'month' | 'semester'
  totalAmount: number
  discountAmount: number
  discountReason: string | null
  taxAmount: number
  finalAmount: number

  paymentStatus: PaymentStatus
  paidAmount: number

  semester: string | null       // e.g. "2024/25 Semester 1" for student bookings
  academicYear: string | null

  notes: string | null
  cancelledAt: string | null
  cancellationReason: string | null
  createdBy: string             // user id
  createdAt: string
  updatedAt: string

  // Joined fields
  occupant?: import('./occupant').Occupant
  room?: import('./room').Room
}

export interface BookingPayment {
  id: string
  tenantId: string
  bookingId: string
  amount: number                // pesewas
  method: PaymentMethod
  reference: string | null      // Paystack ref, MoMo transaction ID
  paystackReference: string | null
  status: 'pending' | 'success' | 'failed' | 'reversed'
  paidAt: string | null
  receivedBy: string | null     // staff user id
  notes: string | null
  createdAt: string
}
