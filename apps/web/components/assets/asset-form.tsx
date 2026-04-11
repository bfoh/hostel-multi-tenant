'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Save } from 'lucide-react'

interface Room { id: string; room_number: string; block: string | null }

interface Props {
  rooms: Room[]
  initial?: {
    id?: string
    name?: string
    category?: string
    description?: string | null
    brand?: string | null
    model?: string | null
    serial_number?: string | null
    room_id?: string | null
    location_note?: string | null
    purchase_date?: string | null
    purchase_price_ghs?: string
    supplier?: string | null
    warranty_expiry?: string | null
    condition?: string
    status?: string
    notes?: string | null
  }
}

const CATEGORIES = ['general', 'furniture', 'appliance', 'electronics', 'fixture', 'vehicle', 'other']
const CONDITIONS  = ['excellent', 'good', 'fair', 'poor']
const STATUSES    = ['active', 'maintenance', 'disposed', 'lost']

const inputCls = 'w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text-primary placeholder-text-tertiary focus:border-brand focus:outline-none transition-colors'
const labelCls = 'block text-sm font-medium text-text-primary mb-1'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className={labelCls}>{label}</label>{children}</div>
}

export function AssetForm({ rooms, initial }: Props) {
  const router = useRouter()
  const isEdit = !!initial?.id

  const [name,           setName]           = useState(initial?.name           ?? '')
  const [category,       setCategory]       = useState(initial?.category       ?? 'general')
  const [description,    setDescription]    = useState(initial?.description    ?? '')
  const [brand,          setBrand]          = useState(initial?.brand          ?? '')
  const [model,          setModel]          = useState(initial?.model          ?? '')
  const [serialNumber,   setSerialNumber]   = useState(initial?.serial_number  ?? '')
  const [roomId,         setRoomId]         = useState(initial?.room_id        ?? '')
  const [locationNote,   setLocationNote]   = useState(initial?.location_note  ?? '')
  const [purchaseDate,   setPurchaseDate]   = useState(initial?.purchase_date  ?? '')
  const [purchasePriceGhs, setPurchasePriceGhs] = useState(initial?.purchase_price_ghs ?? '')
  const [supplier,       setSupplier]       = useState(initial?.supplier       ?? '')
  const [warrantyExpiry, setWarrantyExpiry] = useState(initial?.warranty_expiry ?? '')
  const [condition,      setCondition]      = useState(initial?.condition      ?? 'good')
  const [status,         setStatus]         = useState(initial?.status         ?? 'active')
  const [notes,          setNotes]          = useState(initial?.notes          ?? '')

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  async function save() {
    if (!name.trim()) { setError('Asset name is required.'); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        name:           name.trim(),
        category,
        description:    description.trim() || null,
        brand:          brand.trim() || null,
        model:          model.trim() || null,
        serial_number:  serialNumber.trim() || null,
        room_id:        roomId || null,
        location_note:  locationNote.trim() || null,
        purchase_date:  purchaseDate || null,
        purchase_price: purchasePriceGhs ? Math.round(parseFloat(purchasePriceGhs) * 100) : null,
        supplier:       supplier.trim() || null,
        warranty_expiry:warrantyExpiry || null,
        condition,
        status,
        notes:          notes.trim() || null,
      }

      const url    = isEdit ? `/api/assets/${initial!.id}` : '/api/assets'
      const method = isEdit ? 'PATCH' : 'POST'

      const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to save')

      router.push('/assets')
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
        <h3 className="text-sm font-semibold text-text-primary">Asset Details</h3>
        <Field label="Name *">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Dining table" maxLength={120} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Category">
            <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </Field>
          <Field label="Condition">
            <select className={inputCls} value={condition} onChange={(e) => setCondition(e.target.value)}>
              {CONDITIONS.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Brand">
            <input className={inputCls} value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Samsung" maxLength={80} />
          </Field>
          <Field label="Model">
            <input className={inputCls} value={model} onChange={(e) => setModel(e.target.value)} placeholder="WW70T4540TE" maxLength={80} />
          </Field>
        </div>
        <Field label="Serial number">
          <input className={inputCls} value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} placeholder="SN-XXXXXXXX" maxLength={80} />
        </Field>
        <Field label="Description">
          <textarea rows={2} className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional notes about the asset…" maxLength={500} />
        </Field>
      </section>

      {/* Location */}
      <section className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">Location</h3>
        <Field label="Room (optional)">
          <select className={inputCls} value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            <option value="">— Not assigned to a room —</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                Room {r.room_number}{r.block ? ` (${r.block})` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Location note">
          <input className={inputCls} value={locationNote} onChange={(e) => setLocationNote(e.target.value)} placeholder="e.g. Common room, near window" maxLength={200} />
        </Field>
      </section>

      {/* Purchase info */}
      <section className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">Purchase Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Purchase date">
            <input type="date" className={inputCls} value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </Field>
          <Field label="Purchase price (GH₵)">
            <input type="number" min={0} step={0.01} className={inputCls} value={purchasePriceGhs} onChange={(e) => setPurchasePriceGhs(e.target.value)} placeholder="0.00" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Supplier">
            <input className={inputCls} value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Melcom" maxLength={100} />
          </Field>
          <Field label="Warranty expiry">
            <input type="date" className={inputCls} value={warrantyExpiry} onChange={(e) => setWarrantyExpiry(e.target.value)} />
          </Field>
        </div>
      </section>

      {/* Status + notes */}
      <section className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">Status &amp; Notes</h3>
        {isEdit && (
          <Field label="Status">
            <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </Field>
        )}
        <Field label="Notes">
          <textarea rows={2} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional notes…" maxLength={500} />
        </Field>
      </section>

      <button
        onClick={save}
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> {isEdit ? 'Save changes' : 'Add asset'}</>}
      </button>
    </div>
  )
}
