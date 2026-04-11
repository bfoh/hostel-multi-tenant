'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Save } from 'lucide-react'

interface Occupant { id: string; first_name: string; last_name: string }
interface Room     { id: string; room_number: string; block: string | null }

interface Props {
  occupants: Occupant[]
  rooms:     Room[]
  initial?: {
    id?:             string
    description?:    string
    category?:       string
    found_date?:     string
    found_location?: string | null
    occupant_id?:    string | null
    room_id?:        string | null
    status?:         string
    claimed_by?:     string | null
    notes?:          string | null
  }
}

const CATEGORIES = ['electronics','clothing','documents','keys','money','jewellery','bag','other']
const STATUSES   = ['unclaimed','claimed','disposed','donated']

const inputCls = 'w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text-primary placeholder-text-tertiary focus:border-brand focus:outline-none transition-colors'
const labelCls = 'block text-sm font-medium text-text-primary mb-1'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className={labelCls}>{label}</label>{children}</div>
}

export function LfItemForm({ occupants, rooms, initial }: Props) {
  const router  = useRouter()
  const isEdit  = !!initial?.id
  const today   = new Date().toISOString().slice(0, 10)

  const [description,   setDescription]   = useState(initial?.description    ?? '')
  const [category,      setCategory]      = useState(initial?.category        ?? 'other')
  const [foundDate,     setFoundDate]     = useState(initial?.found_date      ?? today)
  const [foundLocation, setFoundLocation] = useState(initial?.found_location  ?? '')
  const [occupantId,    setOccupantId]    = useState(initial?.occupant_id     ?? '')
  const [roomId,        setRoomId]        = useState(initial?.room_id         ?? '')
  const [status,        setStatus]        = useState(initial?.status          ?? 'unclaimed')
  const [claimedBy,     setClaimedBy]     = useState(initial?.claimed_by      ?? '')
  const [notes,         setNotes]         = useState(initial?.notes           ?? '')

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  async function save() {
    if (!description.trim()) { setError('Description is required.'); return }
    if (!foundDate)           { setError('Found date is required.'); return }
    setSaving(true); setError('')
    try {
      const payload: Record<string, unknown> = {
        description:    description.trim(),
        category,
        found_date:     foundDate,
        found_location: foundLocation.trim() || null,
        occupant_id:    occupantId || null,
        room_id:        roomId || null,
        notes:          notes.trim() || null,
      }
      if (isEdit) {
        payload.status     = status
        payload.claimed_by = claimedBy.trim() || null
        if (status === 'claimed' && !initial?.claimed_by) {
          payload.claimed_at = new Date().toISOString()
        }
      }

      const url    = isEdit ? `/api/lost-found/${initial!.id}` : '/api/lost-found'
      const method = isEdit ? 'PATCH' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data   = await res.json()
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to save')

      router.push('/lost-found')
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

      <section className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">Item Details</h3>
        <Field label="Description *">
          <textarea rows={3} className={inputCls} value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Black iPhone 14 with cracked screen, in a blue case…" maxLength={500} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Category">
            <select className={inputCls} value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </Field>
          <Field label="Date found *">
            <input type="date" className={inputCls} value={foundDate} onChange={e => setFoundDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Location found">
          <input className={inputCls} value={foundLocation} onChange={e => setFoundLocation(e.target.value)}
            placeholder="e.g. Common room, Corridor 2B" maxLength={200} />
        </Field>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">Link to Occupant (optional)</h3>
        <Field label="Occupant">
          <select className={inputCls} value={occupantId} onChange={e => setOccupantId(e.target.value)}>
            <option value="">— Unknown —</option>
            {occupants.map(o => <option key={o.id} value={o.id}>{o.first_name} {o.last_name}</option>)}
          </select>
        </Field>
        <Field label="Room">
          <select className={inputCls} value={roomId} onChange={e => setRoomId(e.target.value)}>
            <option value="">— Not linked to a room —</option>
            {rooms.map(r => <option key={r.id} value={r.id}>Room {r.room_number}{r.block ? ` (${r.block})` : ''}</option>)}
          </select>
        </Field>
      </section>

      {isEdit && (
        <section className="rounded-xl border border-border bg-surface p-5 space-y-4">
          <h3 className="text-sm font-semibold text-text-primary">Resolution</h3>
          <Field label="Status">
            <select className={inputCls} value={status} onChange={e => setStatus(e.target.value)}>
              {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </Field>
          {status === 'claimed' && (
            <Field label="Claimed by (if not linked above)">
              <input className={inputCls} value={claimedBy} onChange={e => setClaimedBy(e.target.value)}
                placeholder="Full name of person who claimed" maxLength={150} />
            </Field>
          )}
        </section>
      )}

      <section className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">Notes</h3>
        <textarea rows={2} className={inputCls} value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Storage location, condition details…" maxLength={500} />
      </section>

      <button
        onClick={save}
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {saving
          ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
          : <><Save className="h-4 w-4" /> {isEdit ? 'Save changes' : 'Log item'}</>
        }
      </button>
    </div>
  )
}
