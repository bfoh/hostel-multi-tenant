'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, ChevronLeft, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { GhanaCardCapture } from '@/components/public/ghana-card-capture'
import { formatGHS } from '@/lib/utils'

type RoomOption = {
  room_id:     string
  room_number: string
  block:       string | null
  floor:       number | null
  capacity:    number
  beds_taken:  number
  free_beds:   number
}

type Category = {
  id: string
  name: string
  description: string | null
  base_rate: number
  rate_unit: string
  available: number
  rooms?: RoomOption[]
}

interface Props {
  tenant: { slug: string; name: string }
  categories: Category[]
}

type Form = {
  first_name: string
  last_name: string
  phone: string
  email: string
  gender: '' | 'male' | 'female' | 'prefer_not_to_say'
  institution: string
  student_id: string
  programme: string
  emergency_contact_name: string
  emergency_contact_phone: string
  category_id: string
  room_id:     string         // '' = "Auto-assign"
  bed_label:   string         // '' = "Any free bed"
  check_in_date: string
  check_out_date: string
  notes: string
}

const STEPS = ['Your details', 'Room', 'Ghana Card', 'Review'] as const

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function addMonths(iso: string, months: number) {
  const d = new Date(iso + 'T00:00:00')
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

export function SelfCheckinFlow({ tenant, categories }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<Form>({
    first_name: '',
    last_name:  '',
    phone:      '',
    email:      '',
    gender:     '',
    institution: '',
    student_id:  '',
    programme:   '',
    emergency_contact_name:  '',
    emergency_contact_phone: '',
    category_id: '',
    room_id:     '',
    bed_label:   '',
    check_in_date:  todayIso(),
    check_out_date: addMonths(todayIso(), 4),
    notes: '',
  })
  const [frontFile, setFrontFile] = useState<File | null>(null)
  const [frontPreview, setFrontPreview] = useState<string | null>(null)
  const [backFile, setBackFile] = useState<File | null>(null)
  const [backPreview, setBackPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedCategory = categories.find((c) => c.id === form.category_id) ?? null

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function canAdvance(): boolean {
    if (step === 0) {
      return form.first_name.trim().length > 0
        && form.last_name.trim().length > 0
        && form.phone.replace(/\D/g, '').length >= 10
    }
    if (step === 1) return !!form.category_id && form.check_in_date < form.check_out_date
    if (step === 2) return !!frontFile && !!backFile
    return true
  }

  async function submit() {
    if (!frontFile || !backFile) return
    setSubmitting(true)
    setError(null)

    const payload = {
      first_name: form.first_name.trim(),
      last_name:  form.last_name.trim(),
      phone:      form.phone.replace(/[\s\-()]/g, ''),
      email:      form.email.trim() || null,
      gender:     form.gender || null,
      institution: form.institution.trim() || null,
      student_id:  form.student_id.trim() || null,
      programme:   form.programme.trim() || null,
      emergency_contact_name:  form.emergency_contact_name.trim() || null,
      emergency_contact_phone: form.emergency_contact_phone.replace(/[\s\-()]/g, '') || null,
      category_id: form.category_id,
      room_id:     form.room_id || null,
      bed_label:   form.bed_label || null,
      check_in_date:  form.check_in_date,
      check_out_date: form.check_out_date,
      notes: form.notes.trim() || null,
    }

    const fd = new FormData()
    fd.append('payload', JSON.stringify(payload))
    fd.append('ghana_card_front', frontFile)
    fd.append('ghana_card_back',  backFile)

    try {
      const res = await fetch(`/api/public/${tenant.slug}/self-checkin`, {
        method: 'POST',
        body:   fd,
      })
      const json = await res.json()

      if (!res.ok) {
        const msg = typeof json.error === 'string'
          ? json.error
          : 'Something went wrong. Please try again.'
        setError(msg)
        setSubmitting(false)
        return
      }

      if (json.authorization_url) {
        window.location.href = json.authorization_url
        return
      }

      // Paystack URL missing — surface reason before sending to success page
      const reason = typeof json.message === 'string'
        ? json.message
        : 'Online payment unavailable. Pay at the front desk.'
      const params = new URLSearchParams({
        ref: json.booking_ref,
        notice: reason,
      })
      router.push(`/checkin/${tenant.slug}/success?${params.toString()}`)
    } catch {
      setError('Network error. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center justify-between text-xs text-text-tertiary">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-1.5">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                i <= step ? 'bg-brand text-white' : 'bg-surface-sunken text-text-tertiary'
              }`}
            >
              {i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-px w-4 ${i < step ? 'bg-brand' : 'bg-border'}`} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger-subtle p-3 text-sm text-danger">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-4 text-base font-bold text-text-primary">{STEPS[step]}</h2>

        {/* ── Step 0: details ───────────────────────────────────── */}
        {step === 0 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name *">
                <input
                  type="text"
                  autoComplete="given-name"
                  value={form.first_name}
                  onChange={(e) => set('first_name', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Last name *">
                <input
                  type="text"
                  autoComplete="family-name"
                  value={form.last_name}
                  onChange={(e) => set('last_name', e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
            <Field label="Phone *">
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="0244000000"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Gender">
              <select
                value={form.gender}
                onChange={(e) => set('gender', e.target.value as Form['gender'])}
                className={inputCls}
              >
                <option value="">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </Field>
            <Field label="Institution">
              <input
                type="text"
                value={form.institution}
                onChange={(e) => set('institution', e.target.value)}
                className={inputCls}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Student ID">
                <input
                  type="text"
                  value={form.student_id}
                  onChange={(e) => set('student_id', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Programme">
                <input
                  type="text"
                  value={form.programme}
                  onChange={(e) => set('programme', e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Emergency contact name">
                <input
                  type="text"
                  value={form.emergency_contact_name}
                  onChange={(e) => set('emergency_contact_name', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Emergency contact phone">
                <input
                  type="tel"
                  inputMode="tel"
                  value={form.emergency_contact_phone}
                  onChange={(e) => set('emergency_contact_phone', e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
          </div>
        )}

        {/* ── Step 1: room ──────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              {categories.map((c) => (
                <label
                  key={c.id}
                  className={`flex cursor-pointer items-start justify-between gap-3 rounded-lg border p-3 transition-colors ${
                    form.category_id === c.id
                      ? 'border-brand bg-brand/5'
                      : 'border-border bg-surface hover:bg-surface-raised'
                  }`}
                >
                  <div className="flex-1">
                    <p className="font-medium text-text-primary">{c.name}</p>
                    {c.description && (
                      <p className="mt-0.5 text-xs text-text-secondary">{c.description}</p>
                    )}
                    <p className="mt-1 text-[11px] text-text-tertiary">
                      {c.available} available
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-text-primary">{formatGHS(c.base_rate)}</p>
                    <p className="text-[11px] text-text-tertiary">per {c.rate_unit}</p>
                  </div>
                  <input
                    type="radio"
                    name="category"
                    value={c.id}
                    checked={form.category_id === c.id}
                    onChange={() => {
                      set('category_id', c.id)
                      set('room_id',   '')
                      set('bed_label', '')
                    }}
                    className="sr-only"
                  />
                </label>
              ))}
            </div>

            {/* Room + bed pickers — appear once a category is chosen */}
            {selectedCategory && selectedCategory.rooms && selectedCategory.rooms.length > 0 && (
              <div className="space-y-3 rounded-lg border border-border bg-surface p-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
                  Pick a specific room (optional)
                </p>

                <Field label="Room">
                  <select
                    value={form.room_id}
                    onChange={(e) => {
                      set('room_id', e.target.value)
                      set('bed_label', '')
                    }}
                    className={inputCls}
                  >
                    <option value="">Auto-assign any available room</option>
                    {selectedCategory.rooms.map((r) => {
                      const label = r.block
                        ? `Block ${r.block} · Room ${r.room_number}`
                        : `Room ${r.room_number}`
                      const beds = r.capacity > 1
                        ? ` · ${r.free_beds}/${r.capacity} beds free`
                        : ''
                      const floor = r.floor !== null ? ` · Floor ${r.floor}` : ''
                      return (
                        <option key={r.room_id} value={r.room_id}>
                          {label}{floor}{beds}
                        </option>
                      )
                    })}
                  </select>
                </Field>

                {form.room_id && (() => {
                  const room = selectedCategory.rooms!.find((r) => r.room_id === form.room_id)
                  if (!room || room.capacity <= 1) return null
                  const bedOptions: string[] = []
                  for (let i = 1; i <= room.capacity; i++) bedOptions.push(`Bed ${i}`)
                  return (
                    <Field label={`Bed slot (${room.free_beds} of ${room.capacity} free)`}>
                      <select
                        value={form.bed_label}
                        onChange={(e) => set('bed_label', e.target.value)}
                        className={inputCls}
                      >
                        <option value="">No preference</option>
                        {bedOptions.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                      <p className="mt-1 text-[11px] text-text-tertiary">
                        Your preference is noted for the front desk. Final bed assignment is confirmed at check-in.
                      </p>
                    </Field>
                  )
                })()}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
              <Field label="Check-in">
                <input
                  type="date"
                  value={form.check_in_date}
                  min={todayIso()}
                  onChange={(e) => set('check_in_date', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Check-out">
                <input
                  type="date"
                  value={form.check_out_date}
                  min={form.check_in_date}
                  onChange={(e) => set('check_out_date', e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
          </div>
        )}

        {/* ── Step 2: Ghana Card ────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Capture both sides of your Ghana Card. Stay close so the text is readable.
            </p>
            <GhanaCardCapture
              label="Front"
              previewUrl={frontPreview}
              onCapture={(f, url) => {
                setFrontFile(f)
                setFrontPreview(url)
              }}
              onClear={() => {
                setFrontFile(null)
                setFrontPreview(null)
              }}
            />
            <GhanaCardCapture
              label="Back"
              previewUrl={backPreview}
              onCapture={(f, url) => {
                setBackFile(f)
                setBackPreview(url)
              }}
              onClear={() => {
                setBackFile(null)
                setBackPreview(null)
              }}
            />
          </div>
        )}

        {/* ── Step 3: review ────────────────────────────────────── */}
        {step === 3 && selectedCategory && (
          <div className="space-y-3 text-sm">
            <Row k="Name" v={`${form.first_name} ${form.last_name}`} />
            <Row k="Phone" v={form.phone} />
            {form.email && <Row k="Email" v={form.email} />}
            {form.institution && <Row k="Institution" v={form.institution} />}
            <Row k="Room" v={selectedCategory.name} />
            <Row k="Check-in" v={form.check_in_date} />
            <Row k="Check-out" v={form.check_out_date} />
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="font-medium text-text-primary">Total</span>
              <span className="text-lg font-bold text-text-primary">
                {formatGHS(selectedCategory.base_rate)}
              </span>
            </div>
            <Field label="Notes (optional)">
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                className={inputCls}
              />
            </Field>
            <div className="flex items-start gap-2 rounded-lg bg-surface-sunken p-3 text-xs text-text-secondary">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-success" />
              <p>
                After payment, show the confirmation code to staff. They will assign your room.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || submitting}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface-raised transition-colors disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canAdvance()}
            className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !canAdvance()}
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {submitting ? 'Submitting…' : 'Submit & Pay'}
          </button>
        )}
      </div>
    </div>
  )
}

const inputCls =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand transition-colors'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-text-secondary">{label}</span>
      {children}
    </label>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-text-tertiary">{k}</span>
      <span className="text-right font-medium text-text-primary">{v}</span>
    </div>
  )
}
