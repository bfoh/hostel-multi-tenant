import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { normalisePage, paginateRows } from '@/lib/data/listing'
import { calculateInvoiceFinancials } from '@/lib/data/booking-finance'

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
  ),
  booking_charges(
    id, description, category, quantity, unit_price, amount,
    payment_method, paid, notes, created_at, updated_at
  )
`

export async function getInvoices(filter?: { payment_status?: string; search?: string }) {
  return (await getInvoicesPage(filter)).rows
}

export async function getInvoicesPage(filter?: { payment_status?: string; search?: string; page?: number }) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return { rows: [] as any[], total: 0, page: 1, pageSize: 100 }

  const supabase = createAdminClient()
  const searchTerms = filter?.search?.trim().toLowerCase().split(/\s+/).filter(Boolean) ?? []
  const allInvoices: any[] = []
  const fetchSize = 1000
  for (let from = 0; ; from += fetchSize) {
    const { data, error } = await supabase
      .from('bookings')
      .select(INVOICE_QUERY)
      .eq('tenant_id', tenantId)
      .not('status', 'in', '(enquiry,cancelled)')
      .order('created_at', { ascending: false })
      .range(from, from + fetchSize - 1)
    if (error) return { rows: [] as any[], total: 0, page: 1, pageSize: 100 }
    allInvoices.push(...(data ?? []))
    if ((data ?? []).length < fetchSize) break
  }

  const filtered = allInvoices.filter((invoice) => {
    const financials = calculateInvoiceFinancials(invoice)
    if (filter?.payment_status && filter.payment_status !== 'all' && financials.paymentStatus !== filter.payment_status) {
      return false
    }
    if (searchTerms.length === 0) return true
    const occupant = Array.isArray(invoice.occupant) ? invoice.occupant[0] : invoice.occupant
    const room = Array.isArray(invoice.room) ? invoice.room[0] : invoice.room
    const haystack = [
      invoice.booking_ref,
      occupant?.first_name,
      occupant?.last_name,
      occupant?.other_names,
      occupant?.phone,
      occupant?.email,
      occupant?.student_id,
      room?.room_number,
      room?.block,
    ].filter(Boolean).join(' ').toLowerCase()
    return searchTerms.every((term) => haystack.includes(term))
  })

  return paginateRows(filtered, normalisePage(filter?.page))
}

export async function getInvoiceById(bookingId: string) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return null

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('bookings')
    .select(INVOICE_QUERY)
    .eq('id', bookingId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) return null
  return data as any
}

export type Invoice = NonNullable<Awaited<ReturnType<typeof getInvoiceById>>>
