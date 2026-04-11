import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, Search, Package } from 'lucide-react'
import { getLfItems, getLfStats } from '@/lib/data/lost-found'

export const metadata: Metadata = { title: 'Lost & Found' }

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  unclaimed: { label: 'Unclaimed', cls: 'bg-warning/10 text-warning' },
  claimed:   { label: 'Claimed',   cls: 'bg-success/10 text-success' },
  disposed:  { label: 'Disposed',  cls: 'bg-surface-raised text-text-tertiary' },
  donated:   { label: 'Donated',   cls: 'bg-brand/10 text-brand' },
}

export default async function LostFoundPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const { status = 'unclaimed', q } = await searchParams
  const [items, stats] = await Promise.all([
    getLfItems({ status, q }),
    getLfStats(),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Lost &amp; Found</h1>
          <p className="mt-1 text-sm text-text-secondary">Log found items and track their return to occupants.</p>
        </div>
        <Link
          href="/lost-found/new"
          className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity shrink-0"
        >
          <Plus className="h-4 w-4" /> Log item
        </Link>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-text-secondary">Unclaimed</p>
          <p className="mt-1.5 text-2xl font-bold text-warning">{stats.unclaimed}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-text-secondary">Claimed</p>
          <p className="mt-1.5 text-2xl font-bold text-success">{stats.claimed}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-text-secondary">Total logged</p>
          <p className="mt-1.5 text-2xl font-bold text-text-primary">{stats.total}</p>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search items…"
            className="rounded-lg border border-border bg-surface pl-9 pr-3 py-1.5 text-sm text-text-primary placeholder-text-tertiary focus:border-brand focus:outline-none"
          />
        </div>
        <select
          name="status"
          defaultValue={status}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text-primary focus:border-brand focus:outline-none"
        >
          <option value="all">All statuses</option>
          <option value="unclaimed">Unclaimed</option>
          <option value="claimed">Claimed</option>
          <option value="disposed">Disposed</option>
          <option value="donated">Donated</option>
        </select>
        <button type="submit" className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity">
          Filter
        </button>
        {(status !== 'unclaimed' || q) && (
          <Link href="/lost-found" className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-raised transition-colors">
            Clear
          </Link>
        )}
      </form>

      {/* List */}
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-16 text-center">
          <Package className="mx-auto h-10 w-10 text-text-disabled mb-3" />
          <p className="text-sm font-medium text-text-primary">No items found</p>
          <p className="text-xs text-text-secondary mt-1">Log found items to help occupants recover their belongings.</p>
          <Link href="/lost-found/new" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            <Plus className="h-4 w-4" /> Log first item
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-raised">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Item</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary hidden sm:table-cell">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Found</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary hidden md:table-cell">Location</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map(item => {
                const badge = STATUS_BADGE[item.status]
                return (
                  <tr key={item.id} className="hover:bg-surface-raised transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-text-primary line-clamp-2">{item.description}</p>
                      {item.occupant && (
                        <p className="text-xs text-text-tertiary">{item.occupant.first_name} {item.occupant.last_name}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-secondary hidden sm:table-cell capitalize">{item.category}</td>
                    <td className="px-4 py-3 text-text-secondary">{item.found_date}</td>
                    <td className="px-4 py-3 text-text-secondary hidden md:table-cell text-xs">{item.found_location ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/lost-found/${item.id}`} className="text-xs text-brand hover:underline">View</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
