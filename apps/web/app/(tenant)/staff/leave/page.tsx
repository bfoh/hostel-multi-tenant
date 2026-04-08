import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, ClipboardList } from 'lucide-react'

import { getLeaveRequests, getStaff } from '@/lib/data/staff'
import { formatDate, initials } from '@/lib/utils'
import { LeaveActions } from '@/components/staff/leave-actions'

export const metadata: Metadata = { title: 'Leave Requests' }

const STATUS_STYLES: Record<string, string> = {
  pending:   'bg-warning-subtle text-warning-fg border-warning/20',
  approved:  'bg-success-subtle text-success border-success/20',
  rejected:  'bg-danger-subtle text-danger border-danger/20',
  cancelled: 'bg-surface-sunken text-text-secondary border-border',
}

const LEAVE_STATUSES = [
  { value: 'all',       label: 'All' },
  { value: 'pending',   label: 'Pending' },
  { value: 'approved',  label: 'Approved' },
  { value: 'rejected',  label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
]

export default async function LeavePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const activeStatus = status ?? 'all'

  const [requests, allStaff] = await Promise.all([
    getLeaveRequests({ status: activeStatus }),
    getStaff(),
  ])

  const pendingCount = requests.filter(r => r.status === 'pending').length

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/staff" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
            <ChevronLeft className="h-4 w-4" /> Staff
          </Link>
          <span className="text-text-disabled">/</span>
          <div>
            <h1 className="text-xl font-bold text-text-primary">Leave requests</h1>
            {pendingCount > 0 && (
              <p className="text-sm text-warning-fg">{pendingCount} pending approval</p>
            )}
          </div>
        </div>
        <LeaveActions staff={allStaff} />
      </div>

      {/* ── Status tabs ──────────────────────────────────────────── */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1">
        {LEAVE_STATUSES.map(s => (
          <Link
            key={s.value}
            href={s.value === 'all' ? '/staff/leave' : `/staff/leave?status=${s.value}`}
            className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeStatus === s.value
                ? 'bg-brand text-brand-fg shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised'
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {/* ── Table ────────────────────────────────────────────────── */}
      {requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <ClipboardList className="h-10 w-10 text-text-disabled" />
          <p className="font-medium text-text-primary">No leave requests found</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Staff</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Period</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Days</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {requests.map(req => {
                const s = Array.isArray(req.staff) ? req.staff[0] : req.staff
                return (
                  <tr key={req.id} className="hover:bg-surface-raised transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/staff/${req.staff_id}?tab=leave`} className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-[10px] font-semibold text-brand">
                          {s ? initials(`${s.first_name} ${s.last_name}`) : '?'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-text-primary hover:text-brand transition-colors">
                            {s ? `${s.first_name} ${s.last_name}` : 'Unknown'}
                          </p>
                          {s?.job_title && <p className="text-xs text-text-tertiary">{s.job_title}</p>}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-primary capitalize">
                      {req.leave_type.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {formatDate(req.start_date)} – {formatDate(req.end_date)}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">{req.days ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLES[req.status] ?? 'bg-surface-sunken text-text-secondary border-border'}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {req.status === 'pending' && (
                        <LeaveApprovalButtons leaveId={req.id} />
                      )}
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

function LeaveApprovalButtons({ leaveId }: { leaveId: string }) {
  // These are client components wrapped in a server component — rendered via LeaveActions
  return (
    <div className="flex gap-1.5">
      <ApproveButton leaveId={leaveId} action="approved" />
      <ApproveButton leaveId={leaveId} action="rejected" />
    </div>
  )
}

// Small inline client-friendly form buttons
function ApproveButton({ leaveId, action }: { leaveId: string; action: 'approved' | 'rejected' }) {
  return (
    <form action={async () => {
      'use server'
      // Server action for quick approve/reject
      const { createClient } = await import('@/lib/supabase/server')
      const { headers } = await import('next/headers')
      const { revalidatePath } = await import('next/cache')

      const headersList = await headers()
      const tenantId = headersList.get('x-tenant-id')
      if (!tenantId) return

      const supabase = await createClient()
      await supabase
        .from('leave_requests')
        .update({ status: action, reviewed_at: new Date().toISOString() })
        .eq('id', leaveId)
        .eq('tenant_id', tenantId)

      revalidatePath('/staff/leave')
    }}>
      <button
        type="submit"
        className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
          action === 'approved'
            ? 'bg-success-subtle text-success hover:bg-success hover:text-white'
            : 'bg-danger-subtle text-danger hover:bg-danger hover:text-white'
        }`}
      >
        {action === 'approved' ? 'Approve' : 'Reject'}
      </button>
    </form>
  )
}
