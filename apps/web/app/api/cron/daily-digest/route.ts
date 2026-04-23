import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/cron/daily-digest
 *
 * Sends a daily SMS summary to each tenant owner with yesterday's KPIs:
 *   - Revenue (total, cash, digital)
 *   - Payment count
 *   - Occupancy %
 *   - Overdue balance
 *
 * Vercel cron: { "path": "/api/cron/daily-digest", "schedule": "0 6 * * *" }
 * (runs 6am UTC daily)
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Fetch active tenants with a phone number
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
      const digest = await buildDigest(tenant.id, supabase)
      const msg = formatSms(tenant.name, digest)
      await sendSms(tenant.contact_phone, msg)
      sent++
    } catch (err) {
      console.error(`[daily-digest] Failed for tenant ${tenant.id}:`, err)
    }
  }

  return NextResponse.json({ ok: true, sent, total: tenants.length })
}

interface Digest {
  revenue:     number // pesewas
  cash:        number
  digital:     number
  paymentCount: number
  occupancyPct: number
  occupiedRooms: number
  totalRooms:    number
  overdueTotal:  number
  overdueCount:  number
  newBookings:   number
}

async function buildDigest(tenantId: string, supabase: any): Promise<Digest> {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const ydStr = yesterday.toISOString().slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)

  // Yesterday's payments
  const { data: payments } = await supabase
    .from('booking_payments')
    .select('amount, method')
    .eq('tenant_id', tenantId)
    .eq('status', 'success')
    .gte('paid_at', `${ydStr}T00:00:00`)
    .lt('paid_at', `${today}T00:00:00`)

  const rows = payments ?? []
  const revenue = rows.reduce((s: number, p: any) => s + p.amount, 0)
  const cash    = rows.filter((p: any) => p.method === 'cash').reduce((s: number, p: any) => s + p.amount, 0)
  const digital = revenue - cash

  // Room occupancy
  const { data: rooms } = await supabase
    .from('rooms')
    .select('status')
    .eq('tenant_id', tenantId)

  const totalRooms = rooms?.length ?? 0
  const occupiedRooms = rooms?.filter((r: any) => r.status === 'occupied').length ?? 0
  const occupancyPct = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0

  // Overdue balances
  const { data: overdue } = await supabase
    .from('bookings')
    .select('final_amount, paid_amount')
    .eq('tenant_id', tenantId)
    .in('payment_status', ['unpaid', 'partial'])
    .in('status', ['confirmed', 'checked_in'])
    .lt('check_in_date', today)

  const overdueRows = overdue ?? []
  const overdueTotal = overdueRows.reduce((s: number, b: any) => s + Math.max(0, b.final_amount - b.paid_amount), 0)

  // New bookings yesterday
  const { count: newBookings } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('created_at', `${ydStr}T00:00:00`)
    .lt('created_at', `${today}T00:00:00`)

  return {
    revenue,
    cash,
    digital,
    paymentCount: rows.length,
    occupancyPct,
    occupiedRooms,
    totalRooms,
    overdueTotal,
    overdueCount: overdueRows.length,
    newBookings: newBookings ?? 0,
  }
}

function formatGHS(pesewas: number): string {
  return `GHS ${(pesewas / 100).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
}

function formatSms(hostelName: string, d: Digest): string {
  const lines = [
    `📊 ${hostelName} — Daily Summary`,
    ``,
    `💰 Revenue: ${formatGHS(d.revenue)} (${d.paymentCount} payment${d.paymentCount !== 1 ? 's' : ''})`,
  ]

  if (d.revenue > 0) {
    lines.push(`   💵 Cash: ${formatGHS(d.cash)} · 📱 Digital: ${formatGHS(d.digital)}`)
  }

  lines.push(`🏠 Occupancy: ${d.occupancyPct}% (${d.occupiedRooms}/${d.totalRooms})`)

  if (d.newBookings > 0) {
    lines.push(`📝 New bookings: ${d.newBookings}`)
  }

  if (d.overdueTotal > 0) {
    lines.push(`⚠️ Overdue: ${formatGHS(d.overdueTotal)} (${d.overdueCount} bookings)`)
  }

  return lines.join('\n').slice(0, 600)
}

async function sendSms(phone: string, message: string) {
  const apiKey = process.env.ARKESEL_API_KEY
  if (!apiKey) {
    console.info('[daily-digest] ARKESEL_API_KEY not set — skipping SMS')
    return
  }

  const digits = phone.replace(/\D/g, '')
  const recipient = digits.startsWith('0') && digits.length === 10
    ? `233${digits.slice(1)}`
    : digits.startsWith('233') ? digits : digits

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
