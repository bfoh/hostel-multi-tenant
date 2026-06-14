import type { Metadata } from 'next'
import Link from 'next/link'
import { Shield, Eye, AlertTriangle, Package, UserX, Key as KeyIcon } from 'lucide-react'

import { getVisitorLog, getIncidentReports, getLostFoundItems, getSecurityStats } from '@/lib/data/security'
import { formatDate } from '@/lib/utils'
import { VisitorCheckIn } from '@/components/security/visitor-checkin'
import { ReportIncidentButton } from '@/components/security/report-incident-button'
import { LogLostFoundButton } from '@/components/security/log-lost-found-button'
import { VisitorPassButton } from '@/components/security/visitor-pass-button'

export const metadata: Metadata = { title: 'Security' }

const SEVERITY_STYLES: Record<string, string> = {
  low:      'bg-surface-sunken text-text-secondary border-border',
  medium:   'bg-warning-subtle text-warning-fg border-warning/20',
  high:     'bg-danger-subtle text-danger border-danger/20',
  critical: 'bg-danger text-white border-danger',
}

const TABS = [
  { id: 'visitors',  label: 'Visitor log' },
  { id: 'incidents', label: 'Incidents' },
  { id: 'lostfound', label: 'Lost & found' },
]

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab = 'visitors' } = await searchParams

  const [stats, visitors, incidents, lostFound] = await Promise.all([
    getSecurityStats(),
    tab === 'visitors'  ? getVisitorLog() : Promise.resolve([]),
    tab === 'incidents' ? getIncidentReports() : Promise.resolve([]),
    tab === 'lostfound' ? getLostFoundItems() : Promise.resolve([]),
  ])

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Security</h1>
          <p className="mt-0.5 text-sm text-text-secondary">Visitor log, incidents, and lost & found</p>
        </div>
        <div className="flex gap-2">
          {tab === 'visitors'  && <VisitorCheckIn />}
          {tab === 'incidents' && <ReportIncidentButton />}
          {tab === 'lostfound' && <LogLostFoundButton />}
        </div>
      </div>

      {/* ── KPI strip ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Visitors today" value={stats.todayVisitors} icon={<Eye className="h-4 w-4" />} />
        <KpiCard label="On premises" value={stats.activeVisitors} icon={<Shield className="h-4 w-4" />} highlight />
        <KpiCard label="Incidents today" value={stats.todayIncidents} icon={<AlertTriangle className="h-4 w-4" />} warn={stats.criticalIncidents > 0} />
        <KpiCard label="Unclaimed items" value={stats.unclaimedItems} icon={<Package className="h-4 w-4" />} />
      </div>

      {/* ── Quick links ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href="/security/blacklist"
          className="flex items-center gap-3 rounded-xl border border-danger/20 bg-danger-subtle px-4 py-3 text-sm font-medium text-danger hover:bg-danger/10 transition-colors"
        >
          <UserX className="h-4 w-4 shrink-0" />
          Manage blacklist &amp; banned occupants
        </Link>
        <Link
          href="/security/keys"
          className="flex items-center gap-3 rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm font-medium text-text-primary hover:bg-surface transition-colors"
        >
          <KeyIcon className="h-4 w-4 shrink-0 text-brand" />
          Key management
        </Link>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
        {TABS.map(t => (
          <Link
            key={t.id}
            href={`/security?tab=${t.id}`}
            className={`flex-1 rounded-md px-3 py-1.5 text-center text-sm font-medium transition-colors ${tab === t.id ? 'bg-brand text-brand-fg shadow-sm' : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised'}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* ── Visitors tab ─────────────────────────────────────────── */}
      {tab === 'visitors' && (
        visitors.length === 0 ? (
          <EmptyState icon={<Eye className="h-10 w-10 text-text-disabled" />} label="No visitors logged today" />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Visitor</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-medium text-text-tertiary sm:table-cell">Purpose</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-medium text-text-tertiary md:table-cell">Host / Room</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Check in</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Check out</th>
                  <th className="w-8 px-2 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visitors.map(v => (
                  <tr key={v.id} className="hover:bg-surface-raised transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-text-primary">{v.visitor_name}</p>
                      {v.visitor_phone && <p className="text-xs text-text-tertiary">{v.visitor_phone}</p>}
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell text-sm text-text-secondary capitalize">
                      {(v.purpose ?? '—').replace('_', ' ')}
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell text-sm text-text-secondary">
                      {v.host_name ?? '—'}{v.room_number ? ` · Room ${v.room_number}` : ''}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {v.check_in_at ? new Date(v.check_in_at).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {v.check_out_at
                        ? new Date(v.check_out_at).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })
                        : <CheckOutButton visitorId={v.id} />
                      }
                    </td>
                    <td className="px-2 py-3">
                      <VisitorPassButton visitorId={v.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── Incidents tab ────────────────────────────────────────── */}
      {tab === 'incidents' && (
        incidents.length === 0 ? (
          <EmptyState icon={<AlertTriangle className="h-10 w-10 text-text-disabled" />} label="No incident reports" />
        ) : (
          <div className="space-y-2">
            {incidents.map(inc => (
              <div key={inc.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="ref-number text-xs text-text-tertiary">{inc.ref_number}</span>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${SEVERITY_STYLES[inc.severity] ?? ''}`}>
                        {inc.severity}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm font-semibold text-text-primary">{inc.title}</p>
                    <p className="mt-0.5 text-xs text-text-secondary line-clamp-2">{inc.description}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-text-tertiary">
                      {inc.location && <span>Location: {inc.location}</span>}
                      <span>{formatDate(inc.occurred_at)}</span>
                      {inc.police_ref && <span>Police ref: {inc.police_ref}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Lost & found tab ─────────────────────────────────────── */}
      {tab === 'lostfound' && (
        lostFound.length === 0 ? (
          <EmptyState icon={<Package className="h-10 w-10 text-text-disabled" />} label="No lost & found items" />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Type</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-medium text-text-tertiary sm:table-cell">Owner</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-medium text-text-tertiary md:table-cell">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lostFound.map(item => (
                  <tr key={item.id} className="hover:bg-surface-raised transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-text-primary">{item.item_name}</p>
                      {item.description && <p className="text-xs text-text-tertiary line-clamp-1">{item.description}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${item.type === 'found' ? 'bg-success-subtle text-success border-success/20' : 'bg-warning-subtle text-warning-fg border-warning/20'}`}>
                        {item.type}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell text-sm text-text-secondary">
                      {item.owner_name ?? '—'}{item.owner_phone ? ` · ${item.owner_phone}` : ''}
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell text-sm text-text-secondary">
                      {item.location_found ?? item.room_number ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${item.status === 'claimed' ? 'bg-success-subtle text-success border-success/20' : 'bg-surface-sunken text-text-secondary border-border'}`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}

function KpiCard({ label, value, icon, highlight, warn }: { label: string; value: number; icon: React.ReactNode; highlight?: boolean; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className={`flex items-center gap-2 text-sm ${warn ? 'text-danger' : 'text-text-secondary'}`}>
        {icon} {label}
      </div>
      <p className={`mt-1.5 text-2xl font-bold ${highlight ? 'text-brand' : warn ? 'text-danger' : 'text-text-primary'}`}>{value}</p>
    </div>
  )
}

function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
      {icon}
      <p className="font-medium text-text-primary">{label}</p>
    </div>
  )
}

function CheckOutButton({ visitorId }: { visitorId: string }) {
  return (
    <form action={async () => {
      'use server'
      const { createClient } = await import('@/lib/supabase/server')
      const { headers } = await import('next/headers')
      const { revalidatePath } = await import('next/cache')
      const headersList = await headers()
      const tenantId = headersList.get('x-tenant-id')
      if (!tenantId) return
      const supabase = await createClient()
      await supabase.from('visitor_log').update({ check_out_at: new Date().toISOString() }).eq('id', visitorId).eq('tenant_id', tenantId).is('check_out_at', null)
      revalidatePath('/security')
    }}>
      <button type="submit" className="text-[11px] text-brand hover:text-brand-hover transition-colors font-medium">
        Check out →
      </button>
    </form>
  )
}
