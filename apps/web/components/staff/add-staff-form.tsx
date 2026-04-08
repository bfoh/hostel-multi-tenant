'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const GHANA_REGIONS = [
  'Ahafo', 'Ashanti', 'Bono', 'Bono East', 'Central', 'Eastern',
  'Greater Accra', 'North East', 'Northern', 'Oti', 'Savannah',
  'Upper East', 'Upper West', 'Volta', 'Western', 'Western North',
]

type FormSection = 'personal' | 'employment' | 'financial' | 'emergency'

export function AddStaffForm() {
  const router = useRouter()
  const [section, setSection] = useState<FormSection>('personal')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    // personal
    first_name: '', last_name: '', other_names: '', email: '',
    phone: '', gender: '', date_of_birth: '',
    // employment
    role: 'receptionist', employment_type: 'full_time',
    job_title: '', department: '', start_date: '', employee_id: '',
    // financial
    basic_salary: '', ghana_card_number: '', tin_number: '', ssnit_number: '',
    is_ssnit_exempt: false,
    bank_name: '', bank_account_number: '', bank_account_name: '',
    momo_number: '', momo_network: '',
    // emergency / address
    emergency_name: '', emergency_phone: '', emergency_relation: '',
    address: '', city: '', region: '',
  })

  const set = (key: string, value: string | boolean) =>
    setForm(f => ({ ...f, [key]: value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          basic_salary: form.basic_salary ? Math.round(parseFloat(form.basic_salary) * 100) : 0,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(JSON.stringify(data.error))
      router.push(`/staff/${data.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add staff member')
      setSaving(false)
    }
  }

  const sections: { id: FormSection; label: string }[] = [
    { id: 'personal',   label: 'Personal' },
    { id: 'employment', label: 'Employment' },
    { id: 'financial',  label: 'Financial' },
    { id: 'emergency',  label: 'Emergency & Address' },
  ]

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* ── Section tabs ─────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
        {sections.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              section === s.id
                ? 'bg-brand text-brand-fg shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Personal ─────────────────────────────────────────────── */}
      {section === 'personal' && (
        <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
          <h2 className="font-semibold text-text-primary">Personal details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name *" required>
              <input value={form.first_name} onChange={e => set('first_name', e.target.value)}
                className={inputCls} placeholder="Kwame" required />
            </Field>
            <Field label="Last name *" required>
              <input value={form.last_name} onChange={e => set('last_name', e.target.value)}
                className={inputCls} placeholder="Mensah" required />
            </Field>
            <Field label="Other names">
              <input value={form.other_names} onChange={e => set('other_names', e.target.value)}
                className={inputCls} placeholder="Middle name" />
            </Field>
            <Field label="Email address *" required>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                className={inputCls} placeholder="kwame@example.com" required />
            </Field>
            <Field label="Phone">
              <input value={form.phone} onChange={e => set('phone', e.target.value)}
                className={inputCls} placeholder="024 000 0000" />
            </Field>
            <Field label="Gender">
              <select value={form.gender} onChange={e => set('gender', e.target.value)} className={inputCls}>
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </Field>
            <Field label="Date of birth">
              <input type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)}
                className={inputCls} />
            </Field>
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={() => setSection('employment')} className={nextBtn}>
              Next: Employment →
            </button>
          </div>
        </div>
      )}

      {/* ── Employment ───────────────────────────────────────────── */}
      {section === 'employment' && (
        <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
          <h2 className="font-semibold text-text-primary">Employment details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="System role *" required>
              <select value={form.role} onChange={e => set('role', e.target.value)} className={inputCls} required>
                <option value="manager">Manager</option>
                <option value="receptionist">Receptionist</option>
                <option value="housekeeper">Housekeeper</option>
                <option value="accountant">Accountant</option>
                <option value="security">Security</option>
              </select>
            </Field>
            <Field label="Employment type">
              <select value={form.employment_type} onChange={e => set('employment_type', e.target.value)} className={inputCls}>
                <option value="full_time">Full-time</option>
                <option value="part_time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="casual">Casual</option>
              </select>
            </Field>
            <Field label="Job title">
              <input value={form.job_title} onChange={e => set('job_title', e.target.value)}
                className={inputCls} placeholder="Front Desk Officer" />
            </Field>
            <Field label="Department">
              <input value={form.department} onChange={e => set('department', e.target.value)}
                className={inputCls} placeholder="Operations" />
            </Field>
            <Field label="Start date">
              <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)}
                className={inputCls} />
            </Field>
            <Field label="Employee ID">
              <input value={form.employee_id} onChange={e => set('employee_id', e.target.value)}
                className={inputCls} placeholder="EMP-001" />
            </Field>
          </div>
          <div className="flex justify-between">
            <button type="button" onClick={() => setSection('personal')} className={backBtn}>← Back</button>
            <button type="button" onClick={() => setSection('financial')} className={nextBtn}>Next: Financial →</button>
          </div>
        </div>
      )}

      {/* ── Financial ────────────────────────────────────────────── */}
      {section === 'financial' && (
        <div className="rounded-xl border border-border bg-surface p-6 space-y-6">
          <h2 className="font-semibold text-text-primary">Financial details</h2>

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-text-secondary">Salary & Tax</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Basic salary (GH₵/month)">
                <input type="number" step="0.01" min="0" value={form.basic_salary}
                  onChange={e => set('basic_salary', e.target.value)}
                  className={inputCls} placeholder="1500.00" />
              </Field>
              <Field label="">
                <label className="flex items-center gap-2 mt-6 cursor-pointer">
                  <input type="checkbox" checked={form.is_ssnit_exempt}
                    onChange={e => set('is_ssnit_exempt', e.target.checked)}
                    className="h-4 w-4 rounded border-border text-brand" />
                  <span className="text-sm text-text-primary">SSNIT exempt</span>
                </label>
              </Field>
              <Field label="Ghana Card number">
                <input value={form.ghana_card_number} onChange={e => set('ghana_card_number', e.target.value)}
                  className={inputCls} placeholder="GHA-000000000-0" />
              </Field>
              <Field label="TIN number">
                <input value={form.tin_number} onChange={e => set('tin_number', e.target.value)}
                  className={inputCls} placeholder="P000000000" />
              </Field>
              <Field label="SSNIT number">
                <input value={form.ssnit_number} onChange={e => set('ssnit_number', e.target.value)}
                  className={inputCls} placeholder="0000000000" />
              </Field>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-text-secondary">Bank account</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Bank name">
                <input value={form.bank_name} onChange={e => set('bank_name', e.target.value)}
                  className={inputCls} placeholder="GCB Bank" />
              </Field>
              <Field label="Account number">
                <input value={form.bank_account_number} onChange={e => set('bank_account_number', e.target.value)}
                  className={inputCls} placeholder="1234567890" />
              </Field>
              <Field label="Account name">
                <input value={form.bank_account_name} onChange={e => set('bank_account_name', e.target.value)}
                  className={inputCls} placeholder="Kwame Mensah" />
              </Field>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-text-secondary">Mobile Money</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="MoMo number">
                <input value={form.momo_number} onChange={e => set('momo_number', e.target.value)}
                  className={inputCls} placeholder="024 000 0000" />
              </Field>
              <Field label="Network">
                <select value={form.momo_network} onChange={e => set('momo_network', e.target.value)} className={inputCls}>
                  <option value="">Select network</option>
                  <option value="mtn">MTN MoMo</option>
                  <option value="vodafone">Telecel Cash</option>
                  <option value="airteltigomoney">AirtelTigo Money</option>
                </select>
              </Field>
            </div>
          </div>

          <div className="flex justify-between">
            <button type="button" onClick={() => setSection('employment')} className={backBtn}>← Back</button>
            <button type="button" onClick={() => setSection('emergency')} className={nextBtn}>Next: Emergency →</button>
          </div>
        </div>
      )}

      {/* ── Emergency & Address ──────────────────────────────────── */}
      {section === 'emergency' && (
        <div className="rounded-xl border border-border bg-surface p-6 space-y-6">
          <h2 className="font-semibold text-text-primary">Emergency contact & address</h2>

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-text-secondary">Emergency contact</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Contact name">
                <input value={form.emergency_name} onChange={e => set('emergency_name', e.target.value)}
                  className={inputCls} placeholder="Akosua Mensah" />
              </Field>
              <Field label="Contact phone">
                <input value={form.emergency_phone} onChange={e => set('emergency_phone', e.target.value)}
                  className={inputCls} placeholder="024 000 0000" />
              </Field>
              <Field label="Relationship">
                <input value={form.emergency_relation} onChange={e => set('emergency_relation', e.target.value)}
                  className={inputCls} placeholder="Spouse" />
              </Field>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-text-secondary">Home address</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Street / house">
                <input value={form.address} onChange={e => set('address', e.target.value)}
                  className={inputCls} placeholder="Plot 12, Abokobi Rd" />
              </Field>
              <Field label="City">
                <input value={form.city} onChange={e => set('city', e.target.value)}
                  className={inputCls} placeholder="Accra" />
              </Field>
              <Field label="Region">
                <select value={form.region} onChange={e => set('region', e.target.value)} className={inputCls}>
                  <option value="">Select region</option>
                  {GHANA_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
            </div>
          </div>

          {error && (
            <p className="rounded-md bg-danger-subtle border border-danger/20 px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <div className="flex justify-between">
            <button type="button" onClick={() => setSection('financial')} className={backBtn}>← Back</button>
            <button type="submit" disabled={saving} className="flex items-center gap-1.5 rounded-md bg-brand px-5 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover disabled:opacity-50 transition-colors">
              {saving ? 'Adding…' : 'Add staff member'}
            </button>
          </div>
        </div>
      )}
    </form>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-xs font-medium text-text-secondary">
          {label}{required && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}
      {children}
    </div>
  )
}

const inputCls = 'w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand transition-colors'
const nextBtn  = 'flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors'
const backBtn  = 'flex items-center gap-1.5 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-raised transition-colors'
