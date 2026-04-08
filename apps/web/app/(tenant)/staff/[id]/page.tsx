import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, Mail, Phone, Building2, Calendar, CreditCard } from 'lucide-react'

import { getStaffById } from '@/lib/data/staff'
import { formatGHS, formatDate, initials } from '@/lib/utils'
import { computeMonthlyPayroll } from '@/lib/payroll/ghana-tax'

export const metadata: Metadata = { title: 'Staff Profile' }

export default async function StaffProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab = 'profile' } = await searchParams
  const staff = await getStaffById(id)

  if (!staff) notFound()

  const payroll = computeMonthlyPayroll(
    staff.basic_salary ?? 0,
    0,
    staff.is_ssnit_exempt ?? false,
  )

  const TABS = [
    { id: 'profile',    label: 'Profile' },
    { id: 'attendance', label: 'Attendance' },
    { id: 'leave',      label: 'Leave' },
    { id: 'payroll',    label: 'Payroll' },
  ]

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb ───────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Link href="/staff" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft className="h-4 w-4" /> Staff
        </Link>
        <span className="text-text-disabled">/</span>
        <span className="text-sm text-text-primary">{staff.first_name} {staff.last_name}</span>
      </div>

      {/* ── Hero card ────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-xl font-bold text-brand">
            {staff.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={staff.photo_url} alt="" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              initials(`${staff.first_name} ${staff.last_name}`)
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-text-primary">
                  {staff.first_name} {staff.other_names ? `${staff.other_names} ` : ''}{staff.last_name}
                </h1>
                <p className="text-sm text-text-secondary">
                  {staff.job_title ?? 'Staff member'}
                  {staff.department ? ` · ${staff.department}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${staff.is_active ? 'bg-success-subtle text-success border-success/20' : 'bg-surface-sunken text-text-secondary border-border'}`}>
                  {staff.is_active ? 'Active' : 'Inactive'}
                </span>
                <Link href={`/staff/${id}?tab=profile&edit=true`} className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-raised transition-colors">
                  Edit
                </Link>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-text-secondary">
              {staff.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  {staff.email}
                </span>
              )}
              {staff.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  {staff.phone}
                </span>
              )}
              {staff.start_date && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Joined {formatDate(staff.start_date)}
                </span>
              )}
              {staff.employee_id && (
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  {staff.employee_id}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
        {TABS.map(t => (
          <Link
            key={t.id}
            href={`/staff/${id}?tab=${t.id}`}
            className={`flex-1 rounded-md px-3 py-1.5 text-center text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-brand text-brand-fg shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* ── Tab: Profile ─────────────────────────────────────────── */}
      {tab === 'profile' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Personal details">
            <Row label="Full name" value={`${staff.first_name} ${staff.other_names ?? ''} ${staff.last_name}`.trim()} />
            <Row label="Gender" value={staff.gender?.replace('_', ' ') ?? '—'} />
            <Row label="Date of birth" value={staff.date_of_birth ? formatDate(staff.date_of_birth) : '—'} />
            <Row label="Ghana Card" value={staff.ghana_card_number ?? '—'} />
            <Row label="TIN" value={staff.tin_number ?? '—'} />
            <Row label="SSNIT" value={staff.ssnit_number ?? '—'} />
          </Section>

          <Section title="Employment">
            <Row label="Employment type" value={(staff.employment_type ?? '').replace('_', ' ')} />
            <Row label="Job title" value={staff.job_title ?? '—'} />
            <Row label="Department" value={staff.department ?? '—'} />
            <Row label="Start date" value={staff.start_date ? formatDate(staff.start_date) : '—'} />
            <Row label="Employee ID" value={staff.employee_id ?? '—'} />
            <Row label="Basic salary" value={staff.basic_salary ? formatGHS(staff.basic_salary) + '/mo' : '—'} />
          </Section>

          <Section title="Bank & MoMo">
            <Row label="Bank name" value={staff.bank_name ?? '—'} />
            <Row label="Account number" value={staff.bank_account_number ?? '—'} />
            <Row label="Account name" value={staff.bank_account_name ?? '—'} />
            <Row label="MoMo number" value={staff.momo_number ?? '—'} />
            <Row label="Network" value={staff.momo_network?.toUpperCase() ?? '—'} />
          </Section>

          <Section title="Emergency contact">
            <Row label="Name" value={staff.emergency_name ?? '—'} />
            <Row label="Phone" value={staff.emergency_phone ?? '—'} />
            <Row label="Relationship" value={staff.emergency_relation ?? '—'} />
            <Row label="Address" value={[staff.address, staff.city, staff.region].filter(Boolean).join(', ') || '—'} />
          </Section>
        </div>
      )}

      {/* ── Tab: Attendance ──────────────────────────────────────── */}
      {tab === 'attendance' && (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          {(!staff.attendance_records || staff.attendance_records.length === 0) ? (
            <div className="py-12 text-center text-sm text-text-secondary">No attendance records yet.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Clock in</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Clock out</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(Array.isArray(staff.attendance_records) ? staff.attendance_records : [])
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map(rec => {
                    const hours = rec.clock_in && rec.clock_out
                      ? ((new Date(rec.clock_out).getTime() - new Date(rec.clock_in).getTime()) / 3600000).toFixed(1)
                      : null
                    return (
                      <tr key={rec.id} className="hover:bg-surface-raised transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-text-primary">{formatDate(rec.date)}</td>
                        <td className="px-4 py-3 text-sm text-text-secondary">
                          {rec.clock_in ? new Date(rec.clock_in).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary">
                          {rec.clock_out ? new Date(rec.clock_out).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' }) : (
                            <span className="inline-flex items-center gap-1 text-success text-xs">
                              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                              On duty
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary">{hours ? `${hours}h` : '—'}</td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Tab: Leave ───────────────────────────────────────────── */}
      {tab === 'leave' && (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          {(!staff.leave_requests || staff.leave_requests.length === 0) ? (
            <div className="py-12 text-center text-sm text-text-secondary">No leave requests yet.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Period</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Days</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(Array.isArray(staff.leave_requests) ? staff.leave_requests : [])
                  .sort((a, b) => b.created_at.localeCompare(a.created_at))
                  .map(lr => (
                    <tr key={lr.id} className="hover:bg-surface-raised transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-text-primary capitalize">
                        {lr.leave_type.replace('_', ' ')}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {formatDate(lr.start_date)} – {formatDate(lr.end_date)}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">{lr.days ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${LEAVE_STATUS_STYLES[lr.status] ?? 'bg-surface-sunken text-text-secondary border-border'}`}>
                          {lr.status}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Tab: Payroll ─────────────────────────────────────────── */}
      {tab === 'payroll' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <PayrollCard label="Basic salary" value={formatGHS(payroll.basicSalary)} note="per month" />
          <PayrollCard label="SSNIT (employee 5.5%)" value={formatGHS(payroll.ssnitEmployee)} note="deducted from gross" highlight="danger" />
          <PayrollCard label="SSNIT (employer 13%)" value={formatGHS(payroll.ssnitEmployer)} note="employer contribution" />
          <PayrollCard label="Taxable income" value={formatGHS(payroll.taxableIncome)} note="gross − SSNIT" />
          <PayrollCard label="PAYE tax" value={formatGHS(payroll.payeTax)} note="Ghana GRA 2024 bands" highlight="danger" />
          <PayrollCard label="Net salary" value={formatGHS(payroll.netSalary)} note="take-home pay" highlight="success" />
          {staff.is_ssnit_exempt && (
            <div className="col-span-full rounded-md bg-warning-subtle border border-warning/20 px-3 py-2 text-sm text-warning-fg">
              This employee is marked SSNIT exempt — SSNIT deductions are not applied.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      </div>
      <dl className="divide-y divide-border">{children}</dl>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 gap-4">
      <dt className="text-xs text-text-secondary shrink-0">{label}</dt>
      <dd className="text-sm text-text-primary text-right">{value}</dd>
    </div>
  )
}

function PayrollCard({ label, value, note, highlight }: {
  label: string; value: string; note: string; highlight?: 'success' | 'danger'
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className={`mt-1 text-xl font-bold currency-amount ${highlight === 'success' ? 'text-success' : highlight === 'danger' ? 'text-danger' : 'text-text-primary'}`}>
        {value}
      </p>
      <p className="text-[11px] text-text-tertiary mt-0.5">{note}</p>
    </div>
  )
}

const LEAVE_STATUS_STYLES: Record<string, string> = {
  pending:   'bg-warning-subtle text-warning-fg border-warning/20',
  approved:  'bg-success-subtle text-success border-success/20',
  rejected:  'bg-danger-subtle text-danger border-danger/20',
  cancelled: 'bg-surface-sunken text-text-secondary border-border',
}
