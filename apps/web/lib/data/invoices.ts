import { createClient } from '@/lib/supabase/server'

const INVOICE_QUERY = `
  id, booking_ref, status, payment_status,
  check_in_date, check_out_date, created_at,
  rate_per_unit, rate_unit, total_amount,
  discount_amount, discount_reason,
  tax_amount, final_amount, paid_amount,
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

export async function getInvoices(filter?: { payment_status?: string; search?: string }) {
  const supabase = await createClient()

  let query = supabase
    .from('bookings')
    .select(INVOICE_QUERY)
    .not('status', 'in', '(enquiry,cancelled)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (filter?.payment_status && filter.payment_status !== 'all') {
    query = query.eq('payment_status', filter.payment_status as 'unpaid')
  }

  const { data, error } = await query
  if (error) return []
  return data ?? []
}

export async function getInvoiceById(bookingId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('bookings')
    .select(INVOICE_QUERY)
    .eq('id', bookingId)
    .single()

  if (error) return null
  return data
}

export type Invoice = NonNullable<Awaited<ReturnType<typeof getInvoiceById>>>
