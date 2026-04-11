import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, Download } from 'lucide-react'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Custom Report Builder' }

function formatGHS(pesewas: number) {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(pesewas / 100)
}

// ── Report config ─────────────────────────────────────────────────────────

const METRICS = [
  { value: 'revenue',   label: 'Revenue (payments received)' },
  { value: 'bookings',  label: 'Bookings (by count)' },
  { value: 'occupancy', label: 'Occupancy (room-nights booked)' },
] as const

const GROUP_BY_OPTIONS: Record<string, { label: string; groups: { value: string; label: string }[] }> = {
  revenue: {
    label: 'Group by',
    groups: [
      { value: 'day',            label: 'Day' },
      { value: 'week',           label: 'Week' },
      { value: 'month',          label: 'Month' },
      { value: 'payment_method', label: 'Payment method' },
      { value: 'room_category',  label: 'Room category' },
    ],
  },
  bookings: {
    label: 'Group by',
    groups: [
      { value: 'day',            label: 'Day' },
      { value: 'week',           label: 'Week' },
      { value: 'month',          label: 'Month' },
      { value: 'status',         label: 'Status' },
      { value: 'source',         label: 'Booking source' },
      { value: 'room_category',  label: 'Room category' },
    ],
  },
  occupancy: {
    label: 'Group by',
    groups: [
      { value: 'month',          label: 'Month' },
      { value: 'week',           label: 'Week' },
      { value: 'room_category',  label: 'Room category' },
    ],
  },
}

// ── Date helpers ──────────────────────────────────────────────────────────

function truncDate(iso: string, groupBy: string): string {
  const d = new Date(iso)
  if (groupBy === 'day') return d.toISOString().slice(0, 10)
  if (groupBy === 'week') {
    const day   = d.getDay()
    const diff  = d.getDate() - day + (day === 0 ? -6 : 1)
    const mon   = new Date(d.setDate(diff))
    return 'W/e ' + mon.toLocaleDateString('en-GH', { month: 'short', day: 'numeric' })
  }
  if (groupBy === 'month') return d.toLocaleDateString('en-GH', { month: 'short', year: 'numeric' })
  return iso
}

// ── Data fetching + aggregation ───────────────────────────────────────────

interface Row { label: string; count: number; amount?: number }

async function runReport(
  tenantId: string,
  metric: string,
  from: string,
  to: string,
  groupBy: string,
): Promise<Row[]> {
  const supabase = await createClient()

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
      else if (groupBy === 'room_category') {
        const cat = p.bookings?.room_categories
        label = cat?.name ?? 'Unknown'
      } else {
        label = truncDate(p.paid_at ?? p.created_at, groupBy)
      }

      const existing = map.get(label) ?? { count: 0, amount: 0 }
      map.set(label, { count: existing.count + 1, amount: existing.amount + (p.amount ?? 0) })
    }

    return Array.from(map.entries()).map(([label, v]) => ({ label, ...v }))
  }

  if (metric === 'bookings') {
    const { data } = await supabase
      .from('bookings')
      .select('id, status, source, created_at, check_in_date, room_categories(name)')
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

    return Array.from(map.entries()).map(([label, count]) => ({ label, count }))
  }

  if (metric === 'occupancy') {
    // Count room-nights booked (check_in ≤ to AND check_out ≥ from)
    const { data: bookings } = await supabase
      .from('bookings')
      .select('check_in_date, check_out_date, room_categories(name)')
      .eq('tenant_id', tenantId)
      .in('status', ['confirmed', 'checked_in', 'checked_out'])
      .lte('check_in_date', to)
      .not('check_out_date', 'is', null)

    const { data: rooms } = await supabase
      .from('rooms')
      .select('id, category_id, room_categories(name)')
      .eq('tenant_id', tenantId)

    const totalRooms = rooms?.length ?? 1

    const map = new Map<string, { nights: number; capacity: number }>()

    for (const b of bookings ?? []) {
      if (!b.check_out_date) continue
      const start = new Date(Math.max(new Date(b.check_in_date).getTime(),  new Date(from).getTime()))
      const end   = new Date(Math.min(new Date(b.check_out_date).getTime(), new Date(to + 'T23:59:59').getTime()))

      let cur = new Date(start)
      while (cur < end) {
        const key = groupBy === 'room_category'
          ? ((b.room_categories as any)?.name ?? 'Unknown')
          : truncDate(cur.toISOString(), groupBy)

        const existing = map.get(key) ?? { nights: 0, capacity: 0 }
        map.set(key, { nights: existing.nights + 1, capacity: totalRooms })
        cur.setDate(cur.getDate() + 1)
      }
    }

    return Array.from(map.entries()).map(([label, v]) => ({
      label,
      count: v.nights,
      amount: totalRooms > 0 ? Math.round((v.nights / totalRooms) * 100) : 0,
    }))
  }

  return []
}

// ── Page ──────────────────────────────────────────────────────────────────

export default async function CustomReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    metric?:  string
    from?:    string
    to?:      string
    groupby?: string
  }>
}) {
  const params = await searchParams
  const metric  = METRICS.find(m => m.value === params.metric)?.value ?? 'revenue'
  const today   = new Date().toISOString().split('T')[0]
  const firstOfMonth = today.slice(0, 8) + '01'
  const from    = params.from    ?? firstOfMonth
  const to      = params.to      ?? today
  const groups  = GROUP_BY_OPTIONS[metric].groups
  const groupBy = groups.find(g => g.value === params.groupby)?.value ?? groups[0].value

  const headersList = await headers()
  const tenantId    = headersList.get('x-tenant-id') ?? ''

  const rows = tenantId ? await runReport(tenantId, metric, from, to, groupBy) : []

  // Totals
  const totalCount  = rows.reduce((s, r) => s + r.count, 0)
  const totalAmount = rows.reduce((s, r) => s + (r.amount ?? 0), 0)
  const hasAmount   = rows.some(r => r.amount !== undefined)

  const isOccupancy = metric === 'occupancy'
  const amountLabel = isOccupancy ? 'Occ. rate' : 'Amount (GH₵)'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link href="/reports" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft className="h-4 w-4" /> Reports
        </Link>
        <span className="text-text-disabled">/</span>
        <h1 className="text-xl font-bold text-text-primary">Custom Report Builder</h1>
      </div>

      {/* Filter form */}
      <form method="get" className="rounded-xl border border-border bg-surface p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Metric */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Metric</label>
            <select
              name="metric"
              defaultValue={metric}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {METRICS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* From */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">From</label>
            <input
              type="date"
              name="from"
              defaultValue={from}
              max={to}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* To */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">To</label>
            <input
              type="date"
              name="to"
              defaultValue={to}
              min={from}
              max={today}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Group by */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">{GROUP_BY_OPTIONS[metric].label}</label>
            <select
              name="groupby"
              defaultValue={groupBy}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {groups.map(g => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
          >
            Run report
          </button>
          <Link
            href={`/reports/custom/export?metric=${metric}&from=${from}&to=${to}&groupby=${groupBy}`}
            className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Link>
        </div>
      </form>

      {/* Results */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
          <p className="text-sm font-medium text-text-primary">No data for this period</p>
          <p className="text-xs text-text-secondary mt-1">Try a different metric, date range, or grouping.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-raised">
            <p className="text-sm font-semibold text-text-primary">
              {METRICS.find(m => m.value === metric)?.label}
              {' — '}
              <span className="font-normal text-text-secondary">{from} → {to}</span>
            </p>
            <p className="text-xs text-text-tertiary">{rows.length} row{rows.length !== 1 ? 's' : ''}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary capitalize">
                    {groups.find(g => g.value === groupBy)?.label ?? groupBy}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary">
                    {metric === 'bookings' ? 'Bookings' : metric === 'occupancy' ? 'Room-nights' : 'Transactions'}
                  </th>
                  {hasAmount && (
                    <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary">
                      {amountLabel}
                    </th>
                  )}
                  <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary">% of total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row, i) => {
                  const pct = totalCount > 0 ? ((row.count / totalCount) * 100).toFixed(1) : '0.0'
                  return (
                    <tr key={i} className="hover:bg-surface-raised/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-text-primary">{row.label}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-text-primary">{row.count.toLocaleString()}</td>
                      {hasAmount && (
                        <td className="px-4 py-3 text-right tabular-nums text-text-primary font-semibold">
                          {isOccupancy
                            ? `${row.amount}%`
                            : formatGHS(row.amount ?? 0)
                          }
                        </td>
                      )}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-border overflow-hidden">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs tabular-nums text-text-tertiary w-10 text-right">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="border-t-2 border-border bg-surface-raised">
                <tr>
                  <td className="px-4 py-3 text-xs font-bold text-text-secondary uppercase tracking-wide">Total</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-text-primary">{totalCount.toLocaleString()}</td>
                  {hasAmount && (
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-text-primary">
                      {isOccupancy ? '—' : formatGHS(totalAmount)}
                    </td>
                  )}
                  <td className="px-4 py-3 text-right text-xs text-text-tertiary">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
