'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Plus, Trash2, Loader2, Calendar } from 'lucide-react'

interface StaffMember {
  id: string
  first_name: string
  last_name: string
  department: string | null
  position?: string | null
}

interface Shift {
  id: string
  staff_id: string
  shift_date: string
  shift_start: string
  shift_end: string
  department: string | null
  status: string
  notes: string | null
  staff_profiles?: StaffMember | null
}

const DEPT_COLORS: Record<string, string> = {
  front_desk:   'bg-brand/10 text-brand border-brand/20',
  housekeeping: 'bg-success/10 text-success border-success/20',
  security:     'bg-danger/10 text-danger border-danger/20',
  maintenance:  'bg-warning-subtle text-warning-fg border-warning/20',
  kitchen:      'bg-info/10 text-info border-info/20',
}

const DEPARTMENTS = [
  { value: 'front_desk',   label: 'Front Desk' },
  { value: 'housekeeping', label: 'Housekeeping' },
  { value: 'security',     label: 'Security' },
  { value: 'maintenance',  label: 'Maintenance' },
  { value: 'kitchen',      label: 'Kitchen' },
]

function getWeekDays(monday: string): string[] {
  const days = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

function prevMonday(monday: string) {
  const d = new Date(monday)
  d.setDate(d.getDate() - 7)
  return d.toISOString().slice(0, 10)
}

function nextMonday(monday: string) {
  const d = new Date(monday)
  d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 10)
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function ShiftRota({
  weekStart,
  shifts,
  staff,
}: {
  weekStart: string
  shifts: Shift[]
  staff: StaffMember[]
}) {
  const router = useRouter()
  const days   = getWeekDays(weekStart)
  const today  = new Date().toISOString().slice(0, 10)

  const [addingCell, setAddingCell] = useState<{ staffId: string; date: string } | null>(null)
  const [form, setForm] = useState({ shift_start: '08:00', shift_end: '16:00', department: 'front_desk', notes: '' })
  const [saving, setSaving]     = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)

  // Group shifts: staffId → date → shifts[]
  const shiftMap = new Map<string, Map<string, Shift[]>>()
  for (const s of shifts) {
    if (!shiftMap.has(s.staff_id)) shiftMap.set(s.staff_id, new Map())
    const dayMap = shiftMap.get(s.staff_id)!
    if (!dayMap.has(s.shift_date)) dayMap.set(s.shift_date, [])
    dayMap.get(s.shift_date)!.push(s)
  }

  async function addShift() {
    if (!addingCell) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/staff/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id:    addingCell.staffId,
          shift_date:  addingCell.date,
          shift_start: form.shift_start,
          shift_end:   form.shift_end,
          department:  form.department,
          notes:       form.notes || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setAddingCell(null)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  async function deleteShift(id: string) {
    setDeletingId(id)
    await fetch(`/api/staff/shifts/${id}`, { method: 'DELETE' })
    setDeletingId(null)
    router.refresh()
  }

  const weekLabel = new Date(weekStart).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Shift Scheduling</h1>
          <p className="mt-0.5 text-sm text-text-secondary">Weekly rota · {weekLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/staff/shifts?week=${prevMonday(weekStart)}`}
            className="rounded-md border border-border p-2 hover:bg-surface-raised transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <Link
            href="/staff/shifts"
            className="rounded-md border border-border px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-raised transition-colors flex items-center gap-1.5"
          >
            <Calendar className="h-3.5 w-3.5" />
            This week
          </Link>
          <Link
            href={`/staff/shifts?week=${nextMonday(weekStart)}`}
            className="rounded-md border border-border p-2 hover:bg-surface-raised transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {staff.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="font-medium text-text-primary">No active staff</p>
          <p className="text-sm text-text-secondary mt-1">Add staff members first to build a rota.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-border bg-surface-raised">
                <th className="w-36 px-4 py-3 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wide">
                  Staff
                </th>
                {days.map((d, i) => (
                  <th
                    key={d}
                    className={`px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide min-w-[110px] ${
                      d === today ? 'text-brand' : 'text-text-tertiary'
                    }`}
                  >
                    {DAY_LABELS[i]}<br />
                    <span className={`text-sm font-bold ${d === today ? 'text-brand' : 'text-text-primary'}`}>
                      {new Date(d).getDate()}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {staff.map((member) => {
                const dayMap: Map<string, Shift[]> = shiftMap.get(member.id) ?? new Map()
                return (
                  <tr key={member.id} className="hover:bg-surface-raised/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-text-primary truncate max-w-[120px]">
                        {member.first_name} {member.last_name}
                      </p>
                      {member.department && (
                        <p className="text-[10px] text-text-tertiary capitalize truncate">{member.department.replace(/_/g, ' ')}</p>
                      )}
                    </td>
                    {days.map((date) => {
                      const cellShifts = dayMap.get(date) ?? []
                      return (
                        <td key={date} className={`px-1.5 py-2 align-top ${date === today ? 'bg-brand/5' : ''}`}>
                          <div className="space-y-1">
                            {cellShifts.map((sh) => (
                              <div
                                key={sh.id}
                                className={`rounded border px-1.5 py-1 text-[10px] font-medium group relative ${
                                  DEPT_COLORS[sh.department ?? ''] ?? 'bg-surface-raised text-text-secondary border-border'
                                }`}
                              >
                                <p>{sh.shift_start.slice(0, 5)}–{sh.shift_end.slice(0, 5)}</p>
                                {sh.department && (
                                  <p className="opacity-70 capitalize">{sh.department.replace(/_/g, ' ')}</p>
                                )}
                                <button
                                  onClick={() => deleteShift(sh.id)}
                                  disabled={deletingId === sh.id}
                                  className="absolute top-0.5 right-0.5 hidden group-hover:flex h-4 w-4 items-center justify-center rounded opacity-70 hover:opacity-100"
                                >
                                  {deletingId === sh.id
                                    ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                    : <Trash2 className="h-2.5 w-2.5" />}
                                </button>
                              </div>
                            ))}
                            {/* Add button */}
                            {addingCell?.staffId === member.id && addingCell.date === date ? (
                              <div className="rounded-lg border border-brand/30 bg-brand/5 p-2 space-y-1.5 min-w-[90px]">
                                <div className="grid grid-cols-2 gap-1">
                                  <input
                                    type="time"
                                    value={form.shift_start}
                                    onChange={(e) => setForm({ ...form, shift_start: e.target.value })}
                                    className="rounded border border-border bg-surface px-1 py-0.5 text-[10px] w-full"
                                  />
                                  <input
                                    type="time"
                                    value={form.shift_end}
                                    onChange={(e) => setForm({ ...form, shift_end: e.target.value })}
                                    className="rounded border border-border bg-surface px-1 py-0.5 text-[10px] w-full"
                                  />
                                </div>
                                <select
                                  value={form.department}
                                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                                  className="w-full rounded border border-border bg-surface px-1 py-0.5 text-[10px]"
                                >
                                  {DEPARTMENTS.map((d) => (
                                    <option key={d.value} value={d.value}>{d.label}</option>
                                  ))}
                                </select>
                                {error && <p className="text-[10px] text-danger">{error}</p>}
                                <div className="flex gap-1">
                                  <button
                                    onClick={addShift}
                                    disabled={saving}
                                    className="flex-1 rounded bg-brand text-brand-fg text-[10px] py-0.5 disabled:opacity-50"
                                  >
                                    {saving ? '…' : 'Save'}
                                  </button>
                                  <button
                                    onClick={() => setAddingCell(null)}
                                    className="flex-1 rounded border border-border text-text-secondary text-[10px] py-0.5"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setAddingCell({ staffId: member.id, date }); setError(null) }}
                                className="flex h-6 w-full items-center justify-center rounded border border-dashed border-border text-text-disabled hover:border-brand hover:text-brand transition-colors"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {DEPARTMENTS.map((d) => (
          <div key={d.value} className="flex items-center gap-1.5">
            <div className={`h-3 w-3 rounded border ${DEPT_COLORS[d.value]}`} />
            <span className="text-xs text-text-secondary">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
