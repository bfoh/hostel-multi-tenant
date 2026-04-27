import type { Metadata } from 'next'
import Link from 'next/link'
import {
  BedDouble, CreditCard, LogIn, LogOut, User,
  Settings, HardHat, Shield, FileText, RefreshCw,
  ClipboardList,
} from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata: Metadata = { title: 'Activity Log' }

const ACTION_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  'booking.created':       { label: 'Booking created',       icon: BedDouble,    color: 'bg-brand-subtle text-brand' },
  'booking.status':        { label: 'Booking status changed', icon: RefreshCw,   color: 'bg-warning-subtle text-warning-fg' },
  'booking.cancelled':     { label: 'Booking cancelled',     icon: BedDouble,    color: 'bg-danger-subtle text-danger' },
  'payment.recorded':      { label: 'Payment recorded',      icon: CreditCard,   color: 'bg-success-subtle text-success' },
  'payment.status':        { label: 'Payment status changed', icon: CreditCard,  color: 'bg-warning-subtle text-warning-fg' },
  'occupant.created':      { label: 'Occupant added',        icon: User,         color: 'bg-brand-subtle text-brand' },
  'occupant.updated':      { label: 'Occupant updated',      icon: User,         color: 'bg-surface-raised text-text-secondary' },
  'room.status':           { label: 'Room status changed',   icon: BedDouble,    color: 'bg-warning-subtle text-warning-fg' },
  'maintenance.created':   { label: 'Work order created',    icon: HardHat,      color: 'bg-warning-subtle text-warning-fg' },
  'maintenance.status':    { label: 'Work order updated',    icon: HardHat,      color: 'bg-surface-raised text-text-secondary' },
  'security.incident':     { label: 'Incident reported',     icon: Shield,       color: 'bg-danger-subtle text-danger' },
  'security.visitor':      { label: 'Visitor logged',        icon: User,         color: 'bg-surface-raised text-text-secondary' },
  'auth.login':            { label: 'User signed in',        icon: LogIn,        color: 'bg-surface-raised text-text-secondary' },
  'auth.logout':           { label: 'User signed out',       icon: LogOut,       color: 'bg-surface-raised text-text-secondary' },
  'settings.updated':      { label: 'Settings updated',      icon: Settings,     color: 'bg-surface-raised text-text-secondary' },
  'invoice.downloaded':    { label: 'Invoice downloaded',    icon: FileText,     color: 'bg-surface-raised text-text-secondary' },
}

function getConfig(action: string) {
  // Exact match first, then prefix match
  if (ACTION_CONFIG[action]) return ACTION_CONFIG[action]
  const prefix = Object.keys(ACTION_CONFIG).find(k => action.startsWith(k.split('.')[0]))
  if (prefix) return ACTION_CONFIG[prefix]
  return { label: action, icon: ClipboardList, color: 'bg-surface-raised text-text-secondary' }
}

function formatTime(ts: string) {
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Intl.DateTimeFormat('en-GH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d)
}

const ENTITY_LINKS: Record<string, (id: string) => string> = {
  booking:     (id) => `/bookings/${id}`,
  occupant:    (id) => `/occupants/${id}`,
  room:        (id) => `/rooms/${id}`,
  maintenance: (id) => `/maintenance/${id}`,
  invoice:     (id) => `/invoices/${id}`,
}

const FILTERS = [
  { value: 'all',         label: 'All' },
  { value: 'booking',     label: 'Bookings' },
  { value: 'payment',     label: 'Payments' },
  { value: 'occupant',    label: 'Occupants' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'security',    label: 'Security' },
  { value: 'auth',        label: 'Auth' },
]

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; actor?: string }>
}) {
  const { filter = 'all', actor = '' } = await searchParams
  const supabase = createAdminClient()

  let query = supabase
    .from('audit_log')
    .select('id, actor_name, actor_role, action, entity_type, entity_id, description, occurred_at')
    .order('occurred_at', { ascending: false })
    .limit(200)

  if (filter !== 'all') {
    query = query.like('action', `${filter}.%`)
  }

  if (actor) {
    query = query.ilike('actor_name', `%${actor}%`)
  }

  const { data: entries } = await query

  const log = entries ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Activity Log</h1>
        <p className="mt-0.5 text-sm text-text-secondary">
          Full audit trail of all actions performed in this account
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <Link
            key={f.value}
            href={`/activity?filter=${f.value}${actor ? `&actor=${encodeURIComponent(actor)}` : ''}`}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              filter === f.value
                ? 'bg-brand text-brand-fg'
                : 'bg-surface-raised text-text-secondary hover:text-text-primary'
            }`}
          >
            {f.label}
          </Link>
        ))}

        <form method="GET" action="/activity" className="ml-auto flex gap-2">
          {filter !== 'all' && <input type="hidden" name="filter" value={filter} />}
          <input
            type="search"
            name="actor"
            defaultValue={actor}
            placeholder="Filter by user…"
            className="rounded-md border border-border bg-surface px-3 py-1 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand transition-colors"
          />
          <button
            type="submit"
            className="rounded-md bg-brand px-3 py-1 text-sm font-medium text-brand-fg hover:bg-brand-hover transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      {/* Log */}
      {log.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <ClipboardList className="h-10 w-10 text-text-disabled" />
          <div>
            <p className="font-medium text-text-primary">No activity yet</p>
            <p className="mt-0.5 text-sm text-text-secondary">
              Actions performed in the system will appear here.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="divide-y divide-border">
            {log.map(entry => {
              const cfg  = getConfig(entry.action)
              const Icon = cfg.icon
              const entityLink = entry.entity_type && entry.entity_id
                ? ENTITY_LINKS[entry.entity_type]?.(entry.entity_id)
                : null

              return (
                <div key={entry.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-surface-raised transition-colors">
                  <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${cfg.color}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-text-primary">{cfg.label}</p>
                      <time className="shrink-0 text-xs text-text-tertiary">{formatTime(entry.occurred_at)}</time>
                    </div>

                    {entry.description && (
                      <p className="mt-0.5 text-xs text-text-secondary">{entry.description}</p>
                    )}

                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-text-tertiary">
                      {entry.actor_name && (
                        <span>
                          By <span className="font-medium text-text-secondary">{entry.actor_name}</span>
                          {entry.actor_role ? ` (${entry.actor_role})` : ''}
                        </span>
                      )}
                      {entityLink ? (
                        <Link href={entityLink} className="text-brand hover:underline">
                          View {entry.entity_type}
                        </Link>
                      ) : entry.entity_type ? (
                        <span className="capitalize">{entry.entity_type}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="border-t border-border bg-surface-sunken px-5 py-2.5">
            <p className="text-xs text-text-tertiary">
              {log.length} event{log.length !== 1 ? 's' : ''}
              {filter !== 'all' ? ` · filtered by ${filter}` : ''}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
