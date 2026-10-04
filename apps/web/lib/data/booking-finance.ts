import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'

export interface BookingFinancialSummary {
  invoice_count: number
  total_invoiced: number
  invoice_received: number
  outstanding: number
  overdue_outstanding: number
  overdue_count: number
  customer_credit: number
  unapplied_receipts: number
  room_payments_received: number
  room_payment_count: number
  pending_payments: number
  pending_payment_count: number
  reversed_payments: number
  reversed_payment_count: number
  reversed_charges: number
  reversed_charge_count: number
  total_reversed: number
  charge_payments_received: number
  charge_payment_count: number
  total_receipts: number
  mtd_received: number
  ytd_received: number
  mtd_recognized: number
  ytd_recognized: number
}

export interface BookingReceiptBreakdownRow {
  collector_id: string | null
  source: 'room_payment' | 'booking_charge'
  method: string
  total_amount: number
  transaction_count: number
}

export interface BookingRevenueBreakdownRow {
  source: 'room_payment' | 'booking_charge'
  method: string
  total_amount: number
  transaction_count: number
}

export interface UnappliedBookingReceiptRow {
  booking_id: string
  booking_ref: string
  booking_status: string
  occupant_id: string | null
  occupant_name: string | null
  total_receipts: number
  invoice_received: number
  unapplied_amount: number
  reason: 'cancelled_booking_receipt' | 'enquiry_receipt' | 'customer_credit' | 'unapplied_receipt'
}

export interface StaffShiftFinancials {
  system_cash: number
  system_digital: number
  cash_activity_count: number
  transaction_count: number
  booking_receipts: number
  deposits_collected: number
  deposits_refunded: number
}

export interface BookingAgingRow {
  id: string
  booking_ref: string | null
  booking_status: string
  check_in_date: string
  check_out_date: string | null
  invoice_total: number
  invoice_received: number
  outstanding: number
  occupant_id: string | null
  first_name: string | null
  last_name: string | null
  other_names: string | null
  phone: string | null
  email: string | null
  student_id: string | null
  room_number: string | null
  block: string | null
}

const EMPTY_SUMMARY: BookingFinancialSummary = {
  invoice_count: 0,
  total_invoiced: 0,
  invoice_received: 0,
  outstanding: 0,
  overdue_outstanding: 0,
  overdue_count: 0,
  customer_credit: 0,
  unapplied_receipts: 0,
  room_payments_received: 0,
  room_payment_count: 0,
  pending_payments: 0,
  pending_payment_count: 0,
  reversed_payments: 0,
  reversed_payment_count: 0,
  reversed_charges: 0,
  reversed_charge_count: 0,
  total_reversed: 0,
  charge_payments_received: 0,
  charge_payment_count: 0,
  total_receipts: 0,
  mtd_received: 0,
  ytd_received: 0,
  mtd_recognized: 0,
  ytd_recognized: 0,
}

export async function getBookingFinancialSummary(
  tenantId?: string | null,
): Promise<BookingFinancialSummary> {
  const resolvedTenantId = tenantId ?? await getServerTenantId()
  if (!resolvedTenantId) return EMPTY_SUMMARY

  const supabase = createAdminClient()
  const { data, error } = await (supabase as any).rpc('get_booking_financial_summary', {
    p_tenant_id: resolvedTenantId,
  })

  if (error || !data) {
    console.error('[finance] failed to load canonical booking summary', error)
    throw new Error(`Could not load financial summary: ${error?.message ?? 'empty response'}`)
  }

  return Object.fromEntries(
    Object.keys(EMPTY_SUMMARY).map((key) => [key, Number(data[key] ?? 0)]),
  ) as unknown as BookingFinancialSummary
}

/**
 * Database-aggregated booking and folio receipts for a half-open date range.
 * Keeping aggregation in PostgreSQL avoids Supabase's per-request row cap.
 */
export async function getBookingReceiptBreakdown(
  tenantId: string,
  from: Date | string,
  to: Date | string,
  staffId?: string | null,
): Promise<BookingReceiptBreakdownRow[]> {
  const supabase = createAdminClient()
  const { data, error } = await (supabase as any).rpc('get_booking_receipt_breakdown', {
    p_tenant_id: tenantId,
    p_from: from instanceof Date ? from.toISOString() : from,
    p_to: to instanceof Date ? to.toISOString() : to,
    p_staff_id: staffId ?? null,
  })

  if (error) {
    console.error('[finance] failed to load receipt breakdown', error)
    throw new Error(`Could not load receipt breakdown: ${error.message}`)
  }

  return ((data ?? []) as any[]).map((row) => ({
    collector_id: row.collector_id ?? null,
    source: row.source,
    method: row.method,
    total_amount: Number(row.total_amount ?? 0),
    transaction_count: Number(row.transaction_count ?? 0),
  }))
}

export async function getBookingRevenueBreakdown(
  tenantId: string,
  from: Date | string,
  to: Date | string,
): Promise<BookingRevenueBreakdownRow[]> {
  const supabase = createAdminClient()
  const { data, error } = await (supabase as any).rpc('get_booking_revenue_breakdown', {
    p_tenant_id: tenantId,
    p_from: from instanceof Date ? from.toISOString() : from,
    p_to: to instanceof Date ? to.toISOString() : to,
  })
  if (error) throw new Error(`Could not load recognized booking revenue: ${error.message}`)
  return ((data ?? []) as any[]).map((row) => ({
    source: row.source,
    method: row.method,
    total_amount: Number(row.total_amount ?? 0),
    transaction_count: Number(row.transaction_count ?? 0),
  }))
}

export async function getUnappliedBookingReceipts(
  tenantId: string,
): Promise<UnappliedBookingReceiptRow[]> {
  const supabase = createAdminClient()
  const { data, error } = await (supabase as any).rpc('get_unapplied_booking_receipts', {
    p_tenant_id: tenantId,
  })
  if (error) throw new Error(`Could not load unapplied booking receipts: ${error.message}`)
  return ((data ?? []) as any[]).map((row) => ({
    booking_id: row.booking_id,
    booking_ref: row.booking_ref,
    booking_status: row.booking_status,
    occupant_id: row.occupant_id ?? null,
    occupant_name: row.occupant_name ?? null,
    total_receipts: Number(row.total_receipts ?? 0),
    invoice_received: Number(row.invoice_received ?? 0),
    unapplied_amount: Number(row.unapplied_amount ?? 0),
    reason: row.reason,
  }))
}

export async function getBookingRevenueReport(
  tenantId: string,
  from: string,
  to: string,
  groupBy: string,
): Promise<{ label: string; count: number; amount: number }[]> {
  const supabase = createAdminClient()
  const { data, error } = await (supabase as any).rpc('get_booking_revenue_report', {
    p_tenant_id: tenantId,
    p_from: from,
    p_to: to,
    p_group_by: groupBy,
  })
  if (error) throw new Error(`Could not load booking revenue report: ${error.message}`)
  return ((data ?? []) as any[]).map((row) => ({
    label: row.label,
    count: Number(row.transaction_count ?? 0),
    amount: Number(row.total_amount ?? 0),
  }))
}

export async function getStaffShiftFinancials(
  tenantId: string,
  staffId: string,
  shiftDate: string,
): Promise<StaffShiftFinancials> {
  const supabase = createAdminClient()
  const { data, error } = await (supabase as any).rpc('get_staff_shift_financials', {
    p_tenant_id: tenantId,
    p_staff_id: staffId,
    p_shift_date: shiftDate,
  })

  if (error || !data) {
    console.error('[finance] failed to load shift financials', error)
    throw new Error(`Could not load shift financials: ${error?.message ?? 'empty response'}`)
  }

  return {
    system_cash: Number(data.system_cash ?? 0),
    system_digital: Number(data.system_digital ?? 0),
    cash_activity_count: Number(data.cash_activity_count ?? 0),
    transaction_count: Number(data.transaction_count ?? 0),
    booking_receipts: Number(data.booking_receipts ?? 0),
    deposits_collected: Number(data.deposits_collected ?? 0),
    deposits_refunded: Number(data.deposits_refunded ?? 0),
  }
}

export async function getBookingAgingRows(
  tenantId: string,
  filters: { bookingId?: string | null; occupantId?: string | null } = {},
): Promise<BookingAgingRow[]> {
  const supabase = createAdminClient()
  const rows: BookingAgingRow[] = []
  const pageSize = 1000

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await (supabase as any)
      .rpc('get_booking_aging_rows', {
        p_tenant_id: tenantId,
        p_booking_id: filters.bookingId ?? null,
        p_occupant_id: filters.occupantId ?? null,
      })
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`Could not load booking aging rows: ${error.message}`)

    const page = ((data ?? []) as any[]).map((row) => ({
      ...row,
      invoice_total: Number(row.invoice_total ?? 0),
      invoice_received: Number(row.invoice_received ?? 0),
      outstanding: Number(row.outstanding ?? 0),
    })) as BookingAgingRow[]
    rows.push(...page)
    if (page.length < pageSize) break
  }

  return rows
}

interface ChargeLike {
  amount?: number | null
  paid?: boolean | null
}

interface InvoiceLike {
  final_amount?: number | null
  paid_amount?: number | null
  booking_charges?: ChargeLike[] | ChargeLike | null
}

/** One definition used by invoice lists, details and PDFs. */
export function calculateInvoiceFinancials(invoice: InvoiceLike) {
  const baseAmount = Number(invoice.final_amount ?? 0)
  const roomReceived = Number(invoice.paid_amount ?? 0)
  const rawCharges = invoice.booking_charges ?? []
  const charges = Array.isArray(rawCharges) ? rawCharges : [rawCharges]
  const chargesAmount = charges.reduce((sum, charge) => sum + Number(charge.amount ?? 0), 0)
  const chargesReceived = charges.reduce(
    (sum, charge) => sum + (charge.paid ? Number(charge.amount ?? 0) : 0),
    0,
  )
  const invoiceTotal = baseAmount + chargesAmount
  const invoiceReceived = Math.min(roomReceived, baseAmount) + chargesReceived
  const outstanding = Math.max(0, baseAmount - roomReceived) + chargesAmount - chargesReceived
  const customerCredit = Math.max(0, roomReceived - baseAmount)
  const paymentStatus = outstanding === 0
    ? 'paid'
    : invoiceReceived === 0
      ? 'unpaid'
      : 'partial'

  return {
    baseAmount,
    roomReceived,
    chargesAmount,
    chargesReceived,
    invoiceTotal,
    invoiceReceived,
    outstanding,
    customerCredit,
    paymentStatus,
  }
}
