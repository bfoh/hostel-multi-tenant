import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { formatGHS } from '@/lib/utils'

export const metadata: Metadata = { title: 'Retention Analytics' }

async function getRetentionData(tenantId: string) {
  const supabase = await createClient()

  // Fetch all bookings with occupant info (non-cancelled/no_show)
  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      id, occupant_id, final_amount, paid_amount,
      check_in_date, check_out_date, status, created_at,
      occupants(id, first_name, last_name, phone, email, type, institution)
    `)
    .eq('tenant_id', tenantId)
    .not('status', 'in', '("cancelled","no_show")')
    .order('check_in_date', { ascending: false })

  if (!bookings || bookings.length === 0) return { repeatGuests: [], summary: null }

  // Group by occupant_id
  const byOccupant = new Map<string, typeof bookings>()
  for (const b of bookings) {
    const oid = b.occupant_id
    if (!oid) continue
    if (!byOccupant.has(oid)) byOccupant.set(oid, [])
    byOccupant.get(oid)!.push(b)
  }

  // Build per-occupant stats
  const guestStats = Array.from(byOccupant.entries()).map(([, bks]) => {
    const occ = Array.isArray(bks[0].occupants) ? bks[0].occupants[0] : bks[0].occupants
    const totalSpent = bks.reduce((s, b) => s + (b.paid_amount ?? 0), 0)
    const avgStayDays = bks.reduce((s, b) => {
      const cin  = new Date(b.check_in_date).getTime()
      const cout = new Date(b.check_out_date).getTime()
      return s + Math.max(1, Math.ceil((cout - cin) / 86_400_000))
    }, 0) / bks.length
    const lastStay = bks[0].check_in_date
    const firstStay = bks[bks.length - 1].check_in_date
    return { occ, stayCount: bks.length, totalSpent, avgStayDays, lastStay, firstStay }
  })

  // Sort by total spent descending
  guestStats.sort((a, b) => b.totalSpent - a.totalSpent)

  const repeatGuests   = guestStats.filter((g) => g.stayCount > 1)
  const oneTimeGuests  = guestStats.filter((g) => g.stayCount === 1)

  const totalUniqueOccupants  = guestStats.length
  const totalRepeat            = repeatGuests.length
  const retentionRate          = totalUniqueOccupants > 0
    ? Math.round((totalRepeat / totalUniqueOccupants) * 100)
    : 0

  const avgStaysPerRepeat = repeatGuests.length > 0
    ? (repeatGuests.reduce((s, g) => s + g.stayCount, 0) / repeatGuests.length).toFixed(1)
    : '0'

  const topSpenders = guestStats.slice(0, 10)

  const summary = {
    totalUniqueOccupants,
    totalRepeat,
    oneTime: oneTimeGuests.length,
    retentionRate,
    avgStaysPerRepeat,
    topSpenders,
    repeatGuests: repeatGuests.slice(0, 20),
  }

  return { summary }
}

export default async function RetentionPage() {
  const headersList = await headers()
  const tenantId    = headersList.get('x-tenant-id') ?? ''

  const { summary } = await getRetentionData(tenantId)

  if (!summary) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-text-primary">Retention Analytics</h1>
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="font-medium text-text-primary">No booking data yet</p>
          <p className="mt-1 text-sm text-text-secondary">Retention insights will appear once bookings are recorded.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Retention Analytics</h1>
          <p className="mt-0.5 text-sm text-text-secondary">Repeat guests, loyalty patterns, and top spenders</p>
        </div>
        <Link
          href="/reports"
          className="text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          ← Reports
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-text-tertiary">Unique Guests</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{summary.totalUniqueOccupants}</p>
          <p className="mt-0.5 text-xs text-text-secondary">ever booked</p>
        </div>
        <div className="rounded-xl border border-success/20 bg-success-subtle p-4">
          <p className="text-xs text-success">Repeat Guests</p>
          <p className="mt-1 text-2xl font-bold text-success">{summary.totalRepeat}</p>
          <p className="mt-0.5 text-xs text-success/70">2+ stays</p>
        </div>
        <div className="rounded-xl border border-brand/20 bg-brand/5 p-4">
          <p className="text-xs text-brand">Retention Rate</p>
          <p className="mt-1 text-2xl font-bold text-brand">{summary.retentionRate}%</p>
          <p className="mt-0.5 text-xs text-brand/60">of guests return</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-text-tertiary">Avg Stays (Repeat)</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{summary.avgStaysPerRepeat}x</p>
          <p className="mt-0.5 text-xs text-text-secondary">per returning guest</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Spenders */}
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="border-b border-border px-4 py-3 bg-surface-raised">
            <h2 className="text-sm font-semibold text-text-primary">Top Spenders</h2>
            <p className="text-xs text-text-tertiary">By total payments made</p>
          </div>
          <div className="divide-y divide-border">
            {summary.topSpenders.map((g, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-raised text-xs font-bold text-text-secondary">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {g.occ?.first_name} {g.occ?.last_name}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    {g.stayCount} stay{g.stayCount !== 1 ? 's' : ''} · avg {g.avgStayDays.toFixed(1)} days
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold font-mono text-text-primary">{formatGHS(g.totalSpent)}</p>
                  <p className="text-xs text-text-tertiary">last: {g.lastStay}</p>
                </div>
              </div>
            ))}
            {summary.topSpenders.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-text-tertiary">No data</p>
            )}
          </div>
        </div>

        {/* Repeat guests */}
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="border-b border-border px-4 py-3 bg-surface-raised">
            <h2 className="text-sm font-semibold text-text-primary">Returning Guests</h2>
            <p className="text-xs text-text-tertiary">Guests with 2+ stays (top 20)</p>
          </div>
          <div className="divide-y divide-border">
            {summary.repeatGuests.map((g, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {g.occ?.first_name} {g.occ?.last_name}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    {g.occ?.institution ?? g.occ?.type ?? '—'} · {g.occ?.phone}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="rounded-full bg-success/10 text-success text-xs font-semibold px-2 py-0.5">
                    {g.stayCount}x
                  </span>
                  <p className="mt-0.5 text-xs text-text-tertiary font-mono">{formatGHS(g.totalSpent)}</p>
                </div>
              </div>
            ))}
            {summary.repeatGuests.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-text-tertiary">No repeat guests yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Guest mix */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold text-text-primary mb-4">Guest Mix</h2>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-success font-medium">Returning ({summary.totalRepeat})</span>
              <span className="text-text-tertiary">New ({summary.oneTime})</span>
            </div>
            <div className="h-3 w-full rounded-full bg-surface-sunken overflow-hidden flex">
              <div
                className="h-full bg-success rounded-l-full transition-all"
                style={{ width: `${summary.retentionRate}%` }}
              />
              <div
                className="h-full bg-surface-raised rounded-r-full"
                style={{ width: `${100 - summary.retentionRate}%` }}
              />
            </div>
          </div>
          <span className="text-2xl font-bold text-success shrink-0">{summary.retentionRate}%</span>
        </div>
        <p className="mt-2 text-xs text-text-tertiary">
          {summary.totalRepeat} out of {summary.totalUniqueOccupants} guests have stayed more than once.
        </p>
      </div>
    </div>
  )
}
