import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, UserCog, Search, Users, UserCheck, Clock } from 'lucide-react'

import { getStaff } from '@/lib/data/staff'
import { formatGHS } from '@/lib/utils'
import { initials } from '@/lib/utils'

export const metadata: Metadata = { title: 'Staff' }

const EMPLOYMENT_STYLES: Record<string, string> = {
  full_time: 'bg-success-subtle text-success border-success/20',
  part_time: 'bg-brand-subtle text-brand border-brand/20',
  contract:  'bg-warning-subtle text-warning-fg border-warning/20',
  casual:    'bg-surface-sunken text-text-secondary border-border',
}

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const staff = await getStaff(q)

  const total  = staff.length
  const active = staff.filter(s => s.is_active).length
  const fullTime = staff.filter(s => s.employment_type === 'full_time').length

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Staff</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            {total} team member{total !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/staff/new"
          className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add staff
        </Link>
      </div>

      {/* ── KPI cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-text-secondary text-sm">
            <Users className="h-4 w-4" />
            Total staff
          </div>
          <p className="mt-1.5 text-2xl font-bold text-text-primary">{total}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-text-secondary text-sm">
            <UserCheck className="h-4 w-4" />
            Active
          </div>
          <p className="mt-1.5 text-2xl font-bold text-success">{active}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-text-secondary text-sm">
            <Clock className="h-4 w-4" />
            Full-time
          </div>
          <p className="mt-1.5 text-2xl font-bold text-text-primary">{fullTime}</p>
        </div>
      </div>

      {/* ── Search ───────────────────────────────────────────────── */}
      <form method="get" className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-disabled" />
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search by name, title, or department…"
          className="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-4 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand transition-colors sm:max-w-sm"
        />
      </form>

      {/* ── Table ────────────────────────────────────────────────── */}
      {staff.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <UserCog className="h-10 w-10 text-text-disabled" />
          <div>
            <p className="font-medium text-text-primary">
              {q ? 'No staff match your search' : 'No staff added yet'}
            </p>
            {!q && (
              <p className="mt-0.5 text-sm text-text-secondary">
                Add your first team member to start tracking attendance and payroll.
              </p>
            )}
          </div>
          {!q && (
            <Link
              href="/staff/new"
              className="mt-2 flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add first staff member
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Name</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium text-text-tertiary sm:table-cell">Role / Dept</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium text-text-tertiary md:table-cell">Type</th>
                <th className="hidden px-4 py-3 text-right text-xs font-medium text-text-tertiary lg:table-cell">Basic Salary</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {staff.map((s) => (
                <tr key={s.id} className="hover:bg-surface-raised transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/staff/${s.id}`} className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold text-brand">
                        {s.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.photo_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          initials(`${s.first_name} ${s.last_name}`)
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-text-primary hover:text-brand transition-colors">
                          {s.first_name} {s.last_name}
                        </p>
                        {s.phone && (
                          <p className="text-xs text-text-tertiary">{s.phone}</p>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <p className="text-sm text-text-primary">{s.job_title ?? '—'}</p>
                    {s.department && (
                      <p className="text-xs text-text-tertiary">{s.department}</p>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${EMPLOYMENT_STYLES[s.employment_type ?? 'full_time'] ?? 'bg-surface-sunken text-text-secondary border-border'}`}>
                      {(s.employment_type ?? 'full_time').replace('_', ' ')}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-right lg:table-cell">
                    <span className="currency-amount text-sm text-text-primary">
                      {s.basic_salary ? formatGHS(s.basic_salary) : '—'}
                    </span>
                    <p className="text-[10px] text-text-tertiary">/ month</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${s.is_active ? 'bg-success-subtle text-success border-success/20' : 'bg-surface-sunken text-text-secondary border-border'}`}>
                      {s.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Quick links ──────────────────────────────────────────── */}
      <div className="flex gap-3 flex-wrap">
        <Link href="/staff/attendance" className="rounded-md border border-border bg-surface px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors">
          Attendance log →
        </Link>
        <Link href="/staff/leave" className="rounded-md border border-border bg-surface px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors">
          Leave requests →
        </Link>
        <Link href="/staff/payroll" className="rounded-md border border-border bg-surface px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors">
          Payroll runs →
        </Link>
      </div>
    </div>
  )
}
