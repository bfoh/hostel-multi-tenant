import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { ArrowLeft, Phone, Mail, UserRound } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatGHS } from '@/lib/utils'

export const metadata: Metadata = { title: 'Walk-in visitors' }
export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ q?: string; cursor?: string }>
}

export default async function VisitorsPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const q  = (sp.q ?? '').trim()
  const cursor = sp.cursor ?? null

  const h        = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) notFound()

  const supabase = createAdminClient()

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

  const { data: rowsRaw } = await query
  const rows: any[] = (rowsRaw as any[]) ?? []
  const hasMore = rows.length > 50
  const visible = hasMore ? rows.slice(0, 50) : rows
  const nextCursor = hasMore ? visible[visible.length - 1].last_seen_at : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard"
            className="mb-2 inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft className="h-3 w-3" /> Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-text-primary">Walk-in visitors</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            Customers who paid at the gym, sports centre, laundry or restaurant QR portal.
          </p>
        </div>
      </div>

      <form className="flex items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by name, phone or email…"
          className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
        />
        <button
          type="submit"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
        >
          Search
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-border">
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
