import { type NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

// Reuse same aggregation logic as the page
async function runReport(tenantId: string, metric: string, from: string, to: string, groupBy: string) {
  const supabase = await createClient()

  function truncDate(iso: string, gb: string): string {
    const d = new Date(iso)
    if (gb === 'day')   return d.toISOString().slice(0, 10)
    if (gb === 'week') {
      const day  = d.getDay()
      const diff = d.getDate() - day + (day === 0 ? -6 : 1)
      const mon  = new Date(new Date(d).setDate(diff))
      return 'Week of ' + mon.toISOString().slice(0, 10)
    }
    if (gb === 'month') return d.toISOString().slice(0, 7)
    return iso
  }

  if (metric === 'revenue') {
    const { data } = await supabase
      .from('payments')
      .select('amount, method, paid_at, bookings(room_categories(name))')
      .eq('tenant_id', tenantId)
      .eq('status', 'completed')
      .gte('paid_at', from + 'T00:00:00Z')
      .lte('paid_at', to   + 'T23:59:59Z')
      .order('paid_at')

    const map = new Map<string, { count: number; amount: number }>()
    for (const p of (data ?? []) as any[]) {
      let label: string
      if (groupBy === 'payment_method') label = p.method ?? 'Unknown'
      else if (groupBy === 'room_category') label = p.bookings?.room_categories?.name ?? 'Unknown'
      else label = truncDate(p.paid_at ?? '', groupBy)

      const e = map.get(label) ?? { count: 0, amount: 0 }
      map.set(label, { count: e.count + 1, amount: e.amount + (p.amount ?? 0) })
    }
    return Array.from(map.entries()).map(([label, v]) => ({ label, count: v.count, amount: v.amount }))
  }

  if (metric === 'bookings') {
    const { data } = await supabase
      .from('bookings')
      .select('id, status, source, created_at, room_categories(name)')
      .eq('tenant_id', tenantId)
      .gte('created_at', from + 'T00:00:00Z')
      .lte('created_at', to   + 'T23:59:59Z')
      .order('created_at')

    const map = new Map<string, number>()
    for (const b of data ?? []) {
      let label: string
      if (groupBy === 'status') label = b.status ?? 'Unknown'
      else if (groupBy === 'source') label = b.source ?? 'direct'
      else if (groupBy === 'room_category') label = (b.room_categories as any)?.name ?? 'Unknown'
      else label = truncDate(b.created_at, groupBy)
      map.set(label, (map.get(label) ?? 0) + 1)
    }
    return Array.from(map.entries()).map(([label, count]) => ({ label, count, amount: undefined }))
  }

  if (metric === 'occupancy') {
    const { data: bookings } = await supabase
      .from('bookings')
      .select('check_in_date, check_out_date, room_categories(name)')
      .eq('tenant_id', tenantId)
      .in('status', ['confirmed', 'checked_in', 'checked_out'])
      .lte('check_in_date', to)

    const { count: totalRooms } = await supabase
      .from('rooms')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)

    const rooms = totalRooms ?? 1
    const map = new Map<string, number>()

    for (const b of bookings ?? []) {
      if (!b.check_out_date) continue
      const start = new Date(Math.max(new Date(b.check_in_date).getTime(), new Date(from).getTime()))
      const end   = new Date(Math.min(new Date(b.check_out_date).getTime(), new Date(to + 'T23:59:59').getTime()))
      let cur = new Date(start)
      while (cur < end) {
        const key = groupBy === 'room_category'
          ? ((b.room_categories as any)?.name ?? 'Unknown')
          : truncDate(cur.toISOString(), groupBy)
        map.set(key, (map.get(key) ?? 0) + 1)
        cur.setDate(cur.getDate() + 1)
      }
    }

    return Array.from(map.entries()).map(([label, nights]) => ({
      label,
      count: nights,
      amount: rooms > 0 ? Math.round((nights / rooms) * 100) : 0,
    }))
  }

  return []
}

export async function GET(req: NextRequest) {
  const headersList = await headers()
  const tenantId    = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const metric  = searchParams.get('metric')  ?? 'revenue'
  const from    = searchParams.get('from')    ?? new Date().toISOString().slice(0, 8) + '01'
  const to      = searchParams.get('to')      ?? new Date().toISOString().slice(0, 10)
  const groupBy = searchParams.get('groupby') ?? 'month'

  const rows = await runReport(tenantId, metric, from, to, groupBy)

  const isOccupancy = metric === 'occupancy'
  const hasAmount   = rows.some(r => r.amount !== undefined)

  // Build CSV
  const header = ['Label', 'Count', hasAmount ? (isOccupancy ? 'Occupancy Rate (%)' : 'Amount (GHS)') : null]
    .filter(Boolean).join(',')

  const body = rows.map(r => {
    const amount = r.amount !== undefined
      ? (isOccupancy ? `${r.amount}%` : (r.amount / 100).toFixed(2))
      : null
    return [
      `"${r.label}"`,
      r.count,
      ...(amount !== null ? [amount] : []),
    ].join(',')
  }).join('\n')

  const csv = `${header}\n${body}\n`
  const filename = `report-${metric}-${from}-${to}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
