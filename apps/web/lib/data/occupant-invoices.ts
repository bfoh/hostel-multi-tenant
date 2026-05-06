/**
 * Occupant-scoped invoice queries.
 *
 * "Invoice" in this codebase = a booking row joined with occupant + room +
 * payments. The shape mirrors lib/data/invoices.ts (tenant-side) but every
 * query filters by occupant_id so a student can only see their own.
 *
 * Auth happens at the route layer via getOccupantSession(); these helpers
 * trust their inputs and run with the service role.
 */

import { createAdminClient } from '@/lib/supabase/admin'

const INVOICE_QUERY = `
  id, booking_ref, status, payment_status,
  check_in_date, check_out_date, created_at,
  rate_per_unit, rate_unit, total_amount,
  discount_amount, discount_reason,
  tax_amount, vat_amount, nhil_amount, getfund_amount,
  final_amount, paid_amount,
  semester, academic_year, source, notes,
  occupant:occupants(
    id, first_name, last_name, other_names, phone, email,
    student_id, institution, programme
  ),
  room:rooms(
    id, room_number, block, floor,
    category:room_categories(name, type, base_rate, rate_unit)
  ),
  booking_payments(
    id, amount, method, reference, status, paid_at
  )
`

export async function getOccupantInvoices(occupantId: string, tenantId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('bookings')
    .select(INVOICE_QUERY + ', invoice_number')
    .eq('tenant_id', tenantId)
    .eq('occupant_id', occupantId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('[occupant-invoices] list query failed', error)
    return [] as any[]
  }
  return (data ?? []) as any[]
}

export async function getOccupantInvoiceById(
  bookingId: string,
  occupantId: string,
  tenantId: string,
) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('bookings')
    .select(INVOICE_QUERY + ', invoice_number')
    .eq('id', bookingId)
    .eq('tenant_id', tenantId)
    .eq('occupant_id', occupantId)
    .maybeSingle()

  if (error) {
    console.error('[occupant-invoices] detail query failed', error)
    return null
  }
  return data as any
}

export type OccupantInvoice = NonNullable<Awaited<ReturnType<typeof getOccupantInvoiceById>>>
