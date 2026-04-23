import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle, Clock } from 'lucide-react'
import { getServerTenantId } from '@/lib/auth/tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatGHS } from '@/lib/utils'
import { notFound } from 'next/navigation'

export const metadata: Metadata = { title: 'Debt Aging Report' }

const BUCKETS = [
  { label: '0–30 days',  min: 0,  max: 30,  color: 'bg-warning/10 text-warning-fg border-warning/20' },
  { label: '31–60 days', min: 31, max: 60,  color: 'bg-danger/10 text-danger border-danger/20' },
  { label: '61–90 days', min: 61, max: 90,  color: 'bg-danger/15 text-danger border-danger/30' },
  { label: '90+ days',   min: 91, max: 9999, color: 'bg-danger/20 text-danger border-danger/40' },
]

export default async function DebtAgingPage() {
  const tenantId = await getServerTenantId()
  if (!tenantId) notFound()

  const supabase = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data } = await supabase
    .from('bookings')
    .select(`
      id, booking_ref, check_in_date, check_out_date,
      final_amount, paid_amount, payment_status,
      occupant:occupants(first_name, last_name, phone, email, student_id),
      room:rooms(room_number, block)
    `)
    .eq('tenant_id', tenantId)
    .in('payment_status', ['unpaid', 'partial'])
    .in('status', ['confirmed', 'checked_in'])
    .lt('check_in_date', today)
    .order('check_in_date', { ascending: true })

  const rows = (data ?? []).map((b) => {
    const occupant = Array.isArray(b.occupant) ? b.occupant[0] : b.occupant
    const room     = Array.isArray(b.room)     ? b.room[0]     : b.room
    const balance  = Math.max(0, b.final_amount - b.paid_amount)
    const daysOverdue = Math.floor((Date.now() - new Date(b.check_in_date).getTime()) / 86_400_000)
    return { ...b, occupant, room, balance, daysOverdue }
  })

  // Bucket totals
  const bucketData = BUCKETS.map((bucket) => {
    const items = rows.filter(r => r.daysOverdue >= bucket.min && r.daysOverdue <= bucket.max)
    const total = items.reduce((s, r) => s + r.balance, 0)
    return { ...bucket, items, total, count: items.length }
  })

  const grandTotal = rows.reduce((s, r) => s + r.balance, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/reports"
          className="mb-2 inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="h-3 w-3" /> Reports
        </Link>
        <h1 className="text-2xl font-bold text-text-primary">Debt Aging Report</h1>
        <p className="mt-0.5 text-sm text-text-secondary">
          Outstanding balances grouped by how long they&apos;ve been overdue
        </p>
      </div>

      {/* Bucket summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {bucketData.map((b) => (
          <div key={b.label} className={`rounded-xl border p-4 ${b.color}`}>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4" />
              <p className="text-xs font-semibold">{b.label}</p>
            </div>
            <p className="font-mono text-xl font-bold">{formatGHS(b.total)}</p>
            <p className="text-xs mt-0.5 opacity-70">{b.count} booking{b.count !== 1 ? 's' : ''}</p>
          </div>
        ))}
      </div>

      {/* Grand total */}
      <div className="rounded-xl border border-danger/30 bg-danger/5 p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-danger" />
          <div>
            <p className="font-semibold text-danger">Total Outstanding</p>
            <p className="text-xs text-danger/70">{rows.length} overdue booking{rows.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <p className="font-mono text-2xl font-bold text-danger">{formatGHS(grandTotal)}</p>
      </div>

      {/* Detailed table per bucket */}
      {bucketData.filter(b => b.count > 0).map((bucket) => (
        <div key={bucket.label} className="rounded-xl border border-border overflow-hidden">
          <div className="border-b border-border bg-surface-sunken px-5 py-3 flex items-center justify-between">
            <h2 className="font-semibold text-text-primary text-sm">{bucket.label}</h2>
            <span className="font-mono text-sm font-bold text-danger">{formatGHS(bucket.total)}</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-surface-sunken/50">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Occupant</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary hidden md:table-cell">Room</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary hidden lg:table-cell">Phone</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-text-tertiary">Days</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-tertiary">Billed</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-tertiary">Paid</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-tertiary">Balance</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bucket.items.map((b) => (
                <tr key={b.id} className="hover:bg-surface-raised transition-colors">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-text-primary">
                      {b.occupant?.first_name} {b.occupant?.last_name}
                    </p>
                    {b.occupant?.student_id && (
                      <p className="text-xs text-text-tertiary">{b.occupant.student_id}</p>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary hidden md:table-cell">
                    Room {b.room?.room_number}{b.room?.block ? ` · ${b.room.block}` : ''}
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary hidden lg:table-cell">
                    {b.occupant?.phone ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      b.daysOverdue > 90 ? 'bg-danger text-white' :
                      b.daysOverdue > 60 ? 'bg-danger/20 text-danger' :
                      b.daysOverdue > 30 ? 'bg-danger/10 text-danger' :
                      'bg-warning/10 text-warning-fg'
                    }`}>
                      {b.daysOverdue}d
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-text-secondary">{formatGHS(b.final_amount)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-success">{formatGHS(b.paid_amount)}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold text-danger">{formatGHS(b.balance)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Link href={`/bookings/${b.id}`} className="text-xs font-medium text-brand hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {rows.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-subtle">
            <AlertTriangle className="h-5 w-5 text-success" />
          </div>
          <p className="font-medium text-text-primary">All clear — no overdue debts</p>
          <p className="text-sm text-text-secondary">All active occupants are up to date.</p>
        </div>
      )}
    </div>
  )
}
