import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateInvoiceFinancials, getBookingRevenueBreakdown } from '@/lib/data/booking-finance'

/**
 * POST /api/cron/weekly-digest
 *
 * Sends a comprehensive weekly SMS to each tenant owner every Monday at 6am.
 * Includes: week revenue, top staff, occupancy, overdue, anomalies.
 *
 * Vercel cron: { "path": "/api/cron/weekly-digest", "schedule": "0 6 * * 1" }
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, name, contact_phone')
    .in('status', ['active', 'trial'])

  if (!tenants || tenants.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 })
  }

  let sent = 0

  for (const tenant of tenants) {
    if (!tenant.contact_phone) continue

    try {
      const digest = await buildWeeklyDigest(tenant.id, supabase)
      const msg = formatWeeklySms(tenant.name, digest)
      await sendSms(tenant.contact_phone, msg)
      sent++
    } catch (err) {
      console.error(`[weekly-digest] Failed for tenant ${tenant.id}:`, err)
    }
  }

  return NextResponse.json({ ok: true, sent, total: tenants.length })
}

interface WeeklyDigest {
  weekRevenue:     number
  prevWeekRevenue: number
  changePct:       number
  paymentCount:    number
  cashTotal:       number
  digitalTotal:    number
  auxRevenue:      number
  occupancyPct:    number
  overdueTotal:    number
  overdueCount:    number
  newBookings:     number
  anomalyCount:    number
  discrepancyCount: number
}

async function buildWeeklyDigest(tenantId: string, supabase: any): Promise<WeeklyDigest> {
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000)
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86_400_000)
  const today = now.toISOString().slice(0, 10)

  // Database aggregation includes room payments and paid folio charges and is
  // not truncated by the REST API row cap.
  const thisWeekRows = await getBookingRevenueBreakdown(tenantId, weekAgo, now)
  const weekRevenue = thisWeekRows.reduce((sum, row) => sum + row.total_amount, 0)
  const cashTotal = thisWeekRows
    .filter((row) => row.method === 'cash')
    .reduce((sum, row) => sum + row.total_amount, 0)
  const digitalTotal = weekRevenue - cashTotal
  const paymentCount = thisWeekRows.reduce((sum, row) => sum + row.transaction_count, 0)

  const lastWeekRows = await getBookingRevenueBreakdown(tenantId, twoWeeksAgo, weekAgo)
  const prevWeekRevenue = lastWeekRows.reduce((sum, row) => sum + row.total_amount, 0)
  const changePct = prevWeekRevenue > 0 ? ((weekRevenue - prevWeekRevenue) / prevWeekRevenue) * 100 : 0

  // Auxiliary revenue (revenue points)
  let auxRevenue = 0
  try {
    const { data: auxSales } = await supabase
      .from('revenue_point_sales')
      .select('total_amount')
      .eq('tenant_id', tenantId)
      .gte('sold_at', weekAgo.toISOString())

    auxRevenue = (auxSales ?? []).reduce((s: number, r: any) => s + r.total_amount, 0)
  } catch { /* Table might not exist yet */ }

  // Occupancy
  const { data: rooms } = await supabase
    .from('rooms')
    .select('status')
    .eq('tenant_id', tenantId)
  const totalRooms = rooms?.length ?? 0
  const occupied = rooms?.filter((r: any) => r.status === 'occupied').length ?? 0
  const occupancyPct = totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0

  // Overdue
  const { data: overdue } = await supabase
    .from('bookings')
    .select('final_amount, paid_amount, booking_charges(amount, paid)')
    .eq('tenant_id', tenantId)
    .in('payment_status', ['unpaid', 'partial'])
    .in('status', ['confirmed', 'checked_in'])
    .lt('check_in_date', today)

  const overdueRows = overdue ?? []
  const overdueBalances = overdueRows
    .map((booking: any) => calculateInvoiceFinancials(booking).outstanding)
    .filter((balance: number) => balance > 0)
  const overdueTotal = overdueBalances.reduce((sum: number, balance: number) => sum + balance, 0)

  // New bookings
  const { count: newBookings } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('created_at', weekAgo.toISOString())

  // Anomalies this week
  let anomalyCount = 0
  try {
    const { count } = await supabase
      .from('anomaly_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', weekAgo.toISOString())
    anomalyCount = count ?? 0
  } catch { /* Table might not exist */ }

  // Flagged close-outs
  let discrepancyCount = 0
  try {
    const { count } = await supabase
      .from('shift_closeouts')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'flagged')
      .gte('created_at', weekAgo.toISOString())
    discrepancyCount = count ?? 0
  } catch { /* Table might not exist */ }

  return {
    weekRevenue, prevWeekRevenue, changePct,
    paymentCount, cashTotal, digitalTotal,
    auxRevenue, occupancyPct, overdueTotal,
    overdueCount: overdueBalances.length, newBookings: newBookings ?? 0,
    anomalyCount, discrepancyCount,
  }
}

function fmtGHS(pesewas: number): string {
  return `GHS ${(pesewas / 100).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

function formatWeeklySms(hostelName: string, d: WeeklyDigest): string {
  const trend = d.changePct > 0 ? `↑${d.changePct.toFixed(0)}%` : d.changePct < 0 ? `↓${Math.abs(d.changePct).toFixed(0)}%` : '—'

  const lines = [
    `📊 ${hostelName} — Weekly Report`,
    ``,
    `💰 Booking receipts: ${fmtGHS(d.weekRevenue)} (${trend} vs prev week)`,
    `   💵 Cash: ${fmtGHS(d.cashTotal)} · 📱 Digital: ${fmtGHS(d.digitalTotal)}`,
  ]

  if (d.auxRevenue > 0) {
    lines.push(`🏪 Auxiliary: ${fmtGHS(d.auxRevenue)}`)
  }

  lines.push(
    `🏠 Occupancy: ${d.occupancyPct}%`,
    `📝 New bookings: ${d.newBookings}`,
  )

  if (d.overdueTotal > 0) {
    lines.push(`⚠️ Overdue: ${fmtGHS(d.overdueTotal)} (${d.overdueCount})`)
  }

  if (d.anomalyCount > 0) {
    lines.push(`🚨 Anomalies: ${d.anomalyCount}`)
  }

  if (d.discrepancyCount > 0) {
    lines.push(`🔍 Cash discrepancies: ${d.discrepancyCount}`)
  }

  return lines.join('\n').slice(0, 600)
}

async function sendSms(phone: string, message: string) {
  const apiKey = process.env.ARKESEL_API_KEY
  if (!apiKey) return

  const digits = phone.replace(/\D/g, '')
  const recipient = digits.startsWith('0') && digits.length === 10
    ? `233${digits.slice(1)}`
    : digits

  await fetch('https://sms.arkesel.com/api/v2/sms/send', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: process.env.ARKESEL_SENDER_ID || 'GH Hostels',
      message,
      recipients: [recipient],
    }),
  })
}
