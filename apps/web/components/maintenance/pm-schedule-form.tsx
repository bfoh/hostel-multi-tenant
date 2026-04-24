'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Save } from 'lucide-react'
import { FREQUENCY_LABELS, computeNextDue, type PmFrequency } from '@/lib/data/pm-schedules-shared'

interface Room       { id: string; room_number: string; block: string | null }
interface Contractor { id: string; name: string }

interface Props {
  rooms:       Room[]
  contractors: Contractor[]
  initial?: {
    id?:                    string
    title?:                 string
    description?:           string | null
    category?:              string
    room_id?:               string | null
    location_note?:         string | null
    frequency?:             PmFrequency
    interval_value?:        number
    start_date?:            string
    next_due_date?:         string
    default_priority?:      string
    default_contractor_id?: string | null
    estimated_cost_ghs?:    number | null
    status?:                string
    notes?:                 string | null
  }
}

const CATEGORIES = ['plumbing','electrical','hvac','structural','furniture','appliance','cleaning','pest_control','security','other']
const PRIORITIES = ['low','medium','high','urgent']
const FREQUENCIES: PmFrequency[] = ['daily','weekly','fortnightly','monthly','quarterly','biannual','annual']

const inputCls = 'w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text-primary placeholder-text-tertiary focus:border-brand focus:outline-none transition-colors'
const labelCls = 'block text-sm font-medium text-text-primary mb-1'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className={labelCls}>{label}</label>{children}</div>
}

export function PmScheduleForm({ rooms, contractors, initial }: Props) {
  const router  = useRouter()
  const isEdit  = !!initial?.id
  const today   = new Date().toISOString().slice(0, 10)

  const [title,               setTitle]               = useState(initial?.title               ?? '')
  const [description,         setDescription]         = useState(initial?.description         ?? '')
  const [category,            setCategory]            = useState(initial?.category            ?? 'other')
  const [roomId,              setRoomId]              = useState(initial?.room_id             ?? '')
  const [locationNote,        setLocationNote]        = useState(initial?.location_note       ?? '')
  const [frequency,           setFrequency]           = useState<PmFrequency>(initial?.frequency ?? 'monthly')
  const [intervalValue,       setIntervalValue]       = useState(initial?.interval_value      ?? 1)
  const [startDate,           setStartDate]           = useState(initial?.start_date          ?? today)
  const [defaultPriority,     setDefaultPriority]     = useState(initial?.default_priority    ?? 'medium')
  const [defaultContractorId, setDefaultContractorId] = useState(initial?.default_contractor_id ?? '')
  const [estimatedCostGhs,    setEstimatedCostGhs]    = useState(initial?.estimated_cost_ghs?.toString() ?? '')
  const [status,              setStatus]              = useState(initial?.status              ?? 'active')
  const [notes,               setNotes]               = useState(initial?.notes               ?? '')

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const previewNext = computeNextDue(startDate || today, frequency, intervalValue)

  async function save() {
    if (!title.trim()) { setError('Title is required.'); return }
    if (!startDate)    { setError('Start date is required.'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        title:                 title.trim(),
        description:           description.trim() || null,
        category,
        room_id:               roomId || null,
        location_note:         locationNote.trim() || null,
        frequency,
        interval_value:        intervalValue,
        start_date:            startDate,
        default_priority:      defaultPriority,
        default_contractor_id: defaultContractorId || null,
        estimated_cost_ghs:    estimatedCostGhs ? parseFloat(estimatedCostGhs) : null,
        status,
        notes:                 notes.trim() || null,
      }

      const url    = isEdit ? `/api/pm-schedules/${initial!.id}` : '/api/pm-schedules'
      const method = isEdit ? 'PATCH' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data   = await res.json()
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to save')

      router.push('/maintenance/schedules')
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && <p className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</p>}

      {/* Identity */}
      <section className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">Schedule Details</h3>
        <Field label="Title *">
          <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} placeholder="Monthly boiler inspection" maxLength={150} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Category">
            <select className={inputCls} value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
            </select>
          </Field>
          <Field label="Default priority">
            <select className={inputCls} value={defaultPriority} onChange={e => setDefaultPriority(e.target.value)}>
              {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Description">
          <textarea rows={2} className={inputCls} value={description} onChange={e => setDescription(e.target.value)} placeholder="What work needs to be done…" maxLength={500} />
        </Field>
      </section>

      {/* Recurrence */}
      <section className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">Recurrence</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Frequency">
            <select className={inputCls} value={frequency} onChange={e => setFrequency(e.target.value as PmFrequency)}>
              {FREQUENCIES.map(f => <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>)}
            </select>
          </Field>
          <Field label="Every (interval)">
            <input type="number" min={1} max={52} className={inputCls} value={intervalValue}
              onChange={e => setIntervalValue(Math.max(1, parseInt(e.target.value) || 1))} />
          </Field>
        </div>
        <Field label="Start date *">
          <input type="date" className={inputCls} value={startDate} onChange={e => setStartDate(e.target.value)} />
        </Field>
        {startDate && (
          <p className="text-xs text-text-secondary">
            First work order due: <span className="font-medium text-text-primary">{previewNext}</span>
            {' '}· Repeats every {intervalValue > 1 ? intervalValue + ' ' : ''}{FREQUENCY_LABELS[frequency].toLowerCase()}
          </p>
        )}
      </section>

      {/* Location */}
      <section className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">Location</h3>
        <Field label="Room (optional)">
          <select className={inputCls} value={roomId} onChange={e => setRoomId(e.target.value)}>
            <option value="">— Not room-specific —</option>
            {rooms.map(r => (
              <option key={r.id} value={r.id}>Room {r.room_number}{r.block ? ` (${r.block})` : ''}</option>
            ))}
          </select>
        </Field>
        <Field label="Location note">
          <input className={inputCls} value={locationNote} onChange={e => setLocationNote(e.target.value)} placeholder="e.g. Rooftop, Generator room" maxLength={200} />
        </Field>
      </section>

      {/* Assignment & cost */}
      <section className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">Assignment & Cost</h3>
        <Field label="Default contractor">
          <select className={inputCls} value={defaultContractorId} onChange={e => setDefaultContractorId(e.target.value)}>
            <option value="">— Unassigned —</option>
            {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Estimated cost (GH₵)">
          <input type="number" min={0} step={0.01} className={inputCls} value={estimatedCostGhs}
            onChange={e => setEstimatedCostGhs(e.target.value)} placeholder="0.00" />
        </Field>
      </section>

      {/* Status & notes */}
      <section className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">Status &amp; Notes</h3>
        {isEdit && (
          <Field label="Status">
            <select className={inputCls} value={status} onChange={e => setStatus(e.target.value)}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="archived">Archived</option>
            </select>
          </Field>
        )}
        <Field label="Notes">
          <textarea rows={2} className={inputCls} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional context…" maxLength={500} />
        </Field>
      </section>

      <button
        onClick={save}
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {saving
          ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
          : <><Save className="h-4 w-4" /> {isEdit ? 'Save changes' : 'Create schedule'}</>
        }
      </button>
    </div>
  )
}
