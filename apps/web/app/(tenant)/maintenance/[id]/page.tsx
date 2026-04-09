import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, HardHat, MapPin, Clock, Calendar, DollarSign, AlertTriangle } from 'lucide-react'

import { getMaintenanceById, getContractors } from '@/lib/data/maintenance'
import { formatDate, formatGHS } from '@/lib/utils'
import { MaintenanceEditPanel } from '@/components/maintenance/maintenance-edit-panel'

export const metadata: Metadata = { title: 'Work Order' }

const PRIORITY_STYLES: Record<string, string> = {
  low:    'bg-surface-sunken text-text-secondary border-border',
  medium: 'bg-brand-subtle text-brand border-brand/20',
  high:   'bg-warning-subtle text-warning-fg border-warning/20',
  urgent: 'bg-danger text-white border-danger',
}

const STATUS_STYLES: Record<string, string> = {
  open:        'bg-warning-subtle text-warning-fg border-warning/20',
  in_progress: 'bg-brand-subtle text-brand border-brand/20',
  on_hold:     'bg-surface-sunken text-text-secondary border-border',
  completed:   'bg-success-subtle text-success border-success/20',
  cancelled:   'bg-danger-subtle text-danger border-danger/20',
}

const CATEGORY_LABELS: Record<string, string> = {
  plumbing:     'Plumbing',
  electrical:   'Electrical',
  hvac:         'HVAC / Ventilation',
  structural:   'Structural',
  furniture:    'Furniture',
  appliance:    'Appliance',
  cleaning:     'Cleaning',
  pest_control: 'Pest Control',
  security:     'Security',
  other:        'Other',
}

export default async function MaintenanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [req, contractors] = await Promise.all([
    getMaintenanceById(id),
    getContractors(),
  ])

  if (!req) notFound()

  const room       = Array.isArray(req.room)       ? req.room[0]       : req.room
  const contractor = Array.isArray(req.contractor) ? req.contractor[0] : req.contractor

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Link
          href="/maintenance"
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Maintenance
        </Link>
        <span className="text-text-disabled">/</span>
        <span className="text-sm text-text-primary truncate">{req.title}</span>
      </div>

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-text-tertiary font-mono">{req.ref_number}</span>
            {req.priority === 'urgent' && (
              <AlertTriangle className="h-4 w-4 text-danger" />
            )}
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[req.status] ?? ''}`}>
              {req.status.replace('_', ' ')}
            </span>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${PRIORITY_STYLES[req.priority] ?? ''}`}>
              {req.priority}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-text-primary">{req.title}</h1>
          {req.description && (
            <p className="mt-1 text-sm text-text-secondary">{req.description}</p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left — details ───────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Info grid */}
          <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
            <h2 className="text-sm font-semibold text-text-primary">Details</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-text-tertiary mb-0.5">Category</dt>
                <dd className="font-medium text-text-primary">{CATEGORY_LABELS[req.category] ?? req.category}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-tertiary mb-0.5">Room</dt>
                <dd className="font-medium text-text-primary flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-text-tertiary" />
                  {room
                    ? `Room ${room.room_number}${room.block ? `, Block ${room.block}` : ''}`
                    : <span className="text-text-tertiary">Not specified</span>
                  }
                </dd>
              </div>
              <div>
                <dt className="text-xs text-text-tertiary mb-0.5">Contractor</dt>
                <dd className="font-medium text-text-primary flex items-center gap-1">
                  <HardHat className="h-3.5 w-3.5 text-text-tertiary" />
                  {contractor
                    ? <span>{contractor.name}{contractor.phone ? ` · ${contractor.phone}` : ''}</span>
                    : <span className="text-text-tertiary">Unassigned</span>
                  }
                </dd>
              </div>
              <div>
                <dt className="text-xs text-text-tertiary mb-0.5">Scheduled</dt>
                <dd className="font-medium text-text-primary flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-text-tertiary" />
                  {req.scheduled_date
                    ? formatDate(req.scheduled_date)
                    : <span className="text-text-tertiary">Not set</span>
                  }
                </dd>
              </div>
            </dl>
          </div>

          {/* Cost */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold text-text-primary mb-4">Cost</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-surface-sunken px-4 py-3">
                <p className="text-xs text-text-tertiary">Estimated</p>
                <p className="mt-1 text-lg font-bold text-text-primary currency-amount">
                  {req.estimated_cost != null ? formatGHS(req.estimated_cost) : '—'}
                </p>
              </div>
              <div className="rounded-lg bg-surface-sunken px-4 py-3">
                <p className="text-xs text-text-tertiary">Actual</p>
                <p className={`mt-1 text-lg font-bold currency-amount ${req.actual_cost != null ? 'text-text-primary' : 'text-text-disabled'}`}>
                  {req.actual_cost != null ? formatGHS(req.actual_cost) : '—'}
                </p>
              </div>
            </div>
            {req.actual_cost != null && req.estimated_cost != null && (
              <p className={`mt-2 text-xs ${req.actual_cost > req.estimated_cost ? 'text-danger' : 'text-success'}`}>
                {req.actual_cost > req.estimated_cost
                  ? `Over budget by ${formatGHS(req.actual_cost - req.estimated_cost)}`
                  : `Under budget by ${formatGHS(req.estimated_cost - req.actual_cost)}`
                }
              </p>
            )}
          </div>

          {/* Notes */}
          {req.notes && (
            <div className="rounded-xl border border-border bg-surface p-5">
              <h2 className="text-sm font-semibold text-text-primary mb-2">Notes</h2>
              <p className="text-sm text-text-secondary whitespace-pre-line">{req.notes}</p>
            </div>
          )}

          {/* Timeline */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold text-text-primary mb-4">Timeline</h2>
            <ol className="space-y-3">
              <TimelineItem
                label="Reported"
                date={req.created_at}
                icon={<Clock className="h-3.5 w-3.5" />}
                active
              />
              {req.assigned_at && (
                <TimelineItem
                  label="Assigned to contractor"
                  date={req.assigned_at}
                  icon={<HardHat className="h-3.5 w-3.5" />}
                  active
                />
              )}
              {req.resolved_at && (
                <TimelineItem
                  label="Resolved"
                  date={req.resolved_at}
                  icon={<DollarSign className="h-3.5 w-3.5" />}
                  active
                />
              )}
            </ol>
          </div>
        </div>

        {/* ── Right — edit panel ───────────────────────────────────── */}
        <div>
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold text-text-primary mb-4">Update work order</h2>
            <MaintenanceEditPanel
              requestId={id}
              currentStatus={req.status}
              currentPriority={req.priority}
              currentContractorId={req.contractor_id}
              currentActualCost={req.actual_cost}
              currentNotes={req.notes}
              currentScheduled={req.scheduled_date}
              contractors={contractors}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function TimelineItem({
  label,
  date,
  icon,
  active,
}: {
  label: string
  date: string
  icon: React.ReactNode
  active?: boolean
}) {
  return (
    <li className="flex items-start gap-3">
      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
        active
          ? 'border-brand/20 bg-brand-subtle text-brand'
          : 'border-border bg-surface-raised text-text-tertiary'
      }`}>
        {icon}
      </span>
      <div>
        <p className="text-sm font-medium text-text-primary">{label}</p>
        <p className="text-xs text-text-tertiary">{formatDate(date)}</p>
      </div>
    </li>
  )
}
