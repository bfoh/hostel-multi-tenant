import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { ArrowLeft, Phone, Mail, UserRound } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatGHS } from '@/lib/utils'
import { ExportCsvButton } from '@/components/accounting/export-csv-button'

export const metadata: Metadata = { title: 'Walk-in visitors' }
export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ q?: string; cursor?: string; rp?: string; linked?: string }>
}

export default async function VisitorsPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const q       = (sp.q ?? '').trim()
  const cursor  = sp.cursor ?? null
  const rpId    = sp.rp ?? ''
  const linkedFilter = sp.linked ?? '' // '', 'occupant', 'guest'

  const h        = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) notFound()

  const supabase = createAdminClient()

  // Revenue point list for the filter chips
  const { data: rpsRaw } = await supabase
    .from('revenue_points')
    .select('id, name, type')
    .eq('tenant_id', tenantId)
    .order('name')
  const rps = (rpsRaw ?? []) as any[]

  // If filtering by RP, prefetch the visitor IDs that have a sale at that RP
  let visitorIdsForRp: string[] | null = null
  if (rpId) {
    const { data } = await (supabase as any)
      .from('revenue_point_sales')
      .select('visitor_id')
      .eq('tenant_id', tenantId)
      .eq('revenue_point_id', rpId)
      .not('visitor_id', 'is', null)
      .limit(5000)
    visitorIdsForRp = Array.from(new Set(((data ?? []) as any[]).map((r) => r.visitor_id as string)))
    if (visitorIdsForRp.length === 0) visitorIdsForRp = ['00000000-0000-0000-0000-000000000000']
  }

  let query = supabase
    .from('revenue_point_visitors')
    .select('id, phone, first_name, last_name, email, occupant_id, visit_count, total_spend, first_seen_at, last_seen_at')
    .eq('tenant_id', tenantId)
    .order('last_seen_at', { ascending: false })
    .limit(51)

  if (q) {
    query = query.or(`phone.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
  }
  if (cursor) {
    query = query.lt('last_seen_at', cursor)
  }
  if (visitorIdsForRp) {
    query = query.in('id', visitorIdsForRp)
  }
  if (linkedFilter === 'occupant') {
    query = query.not('occupant_id', 'is', null)
  } else if (linkedFilter === 'guest') {
    query = query.is('occupant_id', null)
  }

  const { data: rowsRaw } = await query
  const rows: any[] = (rowsRaw as any[]) ?? []
  const hasMore = rows.length > 50
  const visible = hasMore ? rows.slice(0, 50) : rows
  const nextCursor = hasMore ? visible[visible.length - 1].last_seen_at : null

  // Full export — independent of page cursor, capped at 5000 for safety
  let exportQuery = (supabase as any)
    .from('revenue_point_visitors')
    .select('phone, first_name, last_name, email, occupant_id, visit_count, total_spend, first_seen_at, last_seen_at')
    .eq('tenant_id', tenantId)
    .order('last_seen_at', { ascending: false })
    .limit(5000)
  if (q) exportQuery = exportQuery.or(`phone.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
  if (visitorIdsForRp) exportQuery = exportQuery.in('id', visitorIdsForRp)
  if (linkedFilter === 'occupant') exportQuery = exportQuery.not('occupant_id', 'is', null)
  if (linkedFilter === 'guest')    exportQuery = exportQuery.is('occupant_id', null)
  const { data: exportRows } = await exportQuery
  const csvRows = ((exportRows ?? []) as any[]).map((v) => [
    [v.first_name, v.last_name].filter(Boolean).join(' '),
    v.phone ?? '',
    v.email ?? '',
    v.occupant_id ? 'resident' : 'guest',
    v.visit_count ?? 0,
    ((v.total_spend ?? 0) / 100).toFixed(2),
    v.first_seen_at ? new Date(v.first_seen_at).toISOString().slice(0, 10) : '',
    v.last_seen_at  ? new Date(v.last_seen_at).toISOString().slice(0, 10)  : '',
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/dashboard"
            className="mb-2 inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft className="h-3 w-3" /> Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-text-primary">Walk-in visitors</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            Marketing CRM · everyone who used a revenue point QR (gym, sports, laundry, restaurant, mini-mart…). De-duped by phone per tenant.
          </p>
        </div>
        <ExportCsvButton
          filename={`walkin-visitors-${new Date().toISOString().slice(0, 10)}`}
          headers={['Name', 'Phone', 'Email', 'Type', 'Visits', 'Total spend (GHS)', 'First seen', 'Last seen']}
          rows={csvRows}
          label={`Export ${csvRows.length} for marketing`}
        />
      </div>

      <form className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by name, phone or email…"
          className="flex-1 min-w-[200px] rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
        />
        {rps.length > 0 && (
          <select
            name="rp"
            defaultValue={rpId}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
          >
            <option value="">All revenue points</option>
            {rps.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        <select
          name="linked"
          defaultValue={linkedFilter}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
        >
          <option value="">Residents + guests</option>
          <option value="occupant">Residents only</option>
          <option value="guest">Outside guests only</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
        >
          Search
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-sunken/50">
            <tr>
              <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">Name</th>
              <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">Contact</th>
              <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">Visits</th>
              <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">Total spend</th>
              <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-text-tertiary hidden md:table-cell">Last seen</th>
              <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-text-tertiary hidden md:table-cell">Link</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-xs text-text-tertiary">
                  No visitors yet. Anyone who pays through a walk-in QR will appear here.
                </td>
              </tr>
            )}
            {visible.map((v) => (
              <tr key={v.id} className="hover:bg-surface-raised transition-colors">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-raised text-xs font-semibold text-text-secondary">
                      {(v.first_name?.[0] ?? '?')}
                    </div>
                    <span className="font-medium text-text-primary">
                      {[v.first_name, v.last_name].filter(Boolean).join(' ') || '—'}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2 text-xs text-text-secondary">
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3 text-text-tertiary" />
                    <a href={`tel:${v.phone}`} className="hover:underline">{v.phone}</a>
                  </div>
                  {v.email && (
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <Mail className="h-3 w-3 text-text-tertiary" />
                      <a href={`mailto:${v.email}`} className="hover:underline truncate">{v.email}</a>
                    </div>
                  )}
                </td>
                <td className="px-4 py-2 text-right font-mono text-text-primary">{v.visit_count}</td>
                <td className="px-4 py-2 text-right font-mono font-semibold text-text-primary">
                  {formatGHS(v.total_spend ?? 0)}
                </td>
                <td className="px-4 py-2 hidden md:table-cell text-xs text-text-tertiary">
                  {v.last_seen_at ? new Date(v.last_seen_at).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-2 hidden md:table-cell">
                  {v.occupant_id ? (
                    <Link
                      href={`/occupants/${v.occupant_id}`}
                      className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
                    >
                      <UserRound className="h-3 w-3" />
                      Occupant
                    </Link>
                  ) : (
                    <span className="text-[11px] text-text-tertiary">Guest</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(nextCursor || cursor) && (
        <div className="flex items-center justify-between text-xs">
          {cursor ? (
            <Link href={`/visitors?q=${encodeURIComponent(q)}`} className="text-brand hover:underline">
              ← First page
            </Link>
          ) : <span />}
          {nextCursor && (
            <Link
              href={`/visitors?q=${encodeURIComponent(q)}&cursor=${encodeURIComponent(nextCursor)}`}
              className="text-brand hover:underline"
            >
              Next page →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
