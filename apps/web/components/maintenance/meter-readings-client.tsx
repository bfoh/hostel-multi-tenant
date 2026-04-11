'use client'

import { useState } from 'react'
import { Plus, Loader2, Zap, Droplets, Flame } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatGHS } from '@/lib/utils'

interface Room { id: string; room_number: string; block?: string; room_categories?: any }
interface Reading {
  id: string; room_id: string; utility_type: string; reading_date: string
  reading_value: number; previous_value: number | null; consumption: number | null
  unit: string; unit_rate: number; charge_amount: number; notes: string | null
  rooms?: any
}

const UTILITY_ICONS: Record<string, React.ElementType> = {
  electricity: Zap, water: Droplets, gas: Flame,
}
const UTILITY_COLORS: Record<string, string> = {
  electricity: 'text-yellow-500 bg-yellow-50',
  water:       'text-blue-500 bg-blue-50',
  gas:         'text-orange-500 bg-orange-50',
}
const UNIT_DEFAULTS: Record<string, string> = {
  electricity: 'kWh', water: 'm3', gas: 'm3',
}

export function MeterReadingsClient({ rooms, initialReadings }: { rooms: Room[]; initialReadings: Reading[] }) {
  const [readings, setReadings] = useState(initialReadings)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterUtility, setFilterUtility] = useState<string>('all')

  // Form state
  const [roomId, setRoomId]         = useState('')
  const [utility, setUtility]       = useState<string>('electricity')
  const [date, setDate]             = useState(new Date().toISOString().slice(0, 10))
  const [value, setValue]           = useState('')
  const [unitRate, setUnitRate]     = useState('0')
  const [notes, setNotes]           = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!roomId) { setError('Select a room'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/rooms/${roomId}/meters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          utility_type:  utility,
          reading_date:  date,
          reading_value: parseFloat(value),
          unit:          UNIT_DEFAULTS[utility],
          unit_rate:     Math.round(parseFloat(unitRate) * 100),
          notes:         notes || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setReadings((prev) => [{ ...data, rooms: rooms.find((r) => r.id === roomId) }, ...prev])
      setShowForm(false)
      setValue(''); setNotes('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  const filtered = filterUtility === 'all' ? readings : readings.filter((r) => r.utility_type === filterUtility)

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {['all', 'electricity', 'water', 'gas'].map((u) => (
            <button key={u} onClick={() => setFilterUtility(u)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors capitalize ${
                filterUtility === u ? 'bg-brand text-brand-fg' : 'text-text-secondary hover:text-text-primary'
              }`}>
              {u}
            </button>
          ))}
        </div>
        <button onClick={() => setShowForm((v) => !v)}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-fg hover:bg-brand-hover transition-colors">
          <Plus className="h-4 w-4" />
          Log reading
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader><CardTitle>Log new reading</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs text-text-tertiary">Room</label>
                  <select value={roomId} onChange={(e) => setRoomId(e.target.value)} required
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand">
                    <option value="">Select room</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        Room {r.room_number}{r.block ? ` (Block ${r.block})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-tertiary">Utility</label>
                  <select value={utility} onChange={(e) => setUtility(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand">
                    <option value="electricity">Electricity</option>
                    <option value="water">Water</option>
                    <option value="gas">Gas</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-tertiary">Reading date</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-tertiary">Reading ({UNIT_DEFAULTS[utility]})</label>
                  <input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} required placeholder="0.00"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-text-tertiary">Rate per unit (GHS)</label>
                  <input type="number" step="0.01" value={unitRate} onChange={(e) => setUnitRate(e.target.value)} placeholder="0.00"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-tertiary">Notes</label>
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand" />
                </div>
              </div>
              {error && <p className="text-xs text-danger">{error}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={saving}
                  className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-60">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-raised transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="pt-0 p-0">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-text-tertiary">No readings logged yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Room</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Utility</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-tertiary">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-text-tertiary">Reading</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-text-tertiary">Consumption</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-text-tertiary">Charge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((r) => {
                    const Icon = UTILITY_ICONS[r.utility_type] ?? Zap
                    const room = Array.isArray(r.rooms) ? r.rooms[0] : r.rooms
                    return (
                      <tr key={r.id} className="hover:bg-surface-raised transition-colors">
                        <td className="px-4 py-3 font-medium text-text-primary">
                          Room {room?.room_number ?? '—'}
                          {room?.block ? ` (${room.block})` : ''}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`flex items-center gap-1.5 w-fit rounded-full px-2 py-0.5 text-xs font-medium capitalize ${UTILITY_COLORS[r.utility_type] ?? ''}`}>
                            <Icon className="h-3 w-3" />
                            {r.utility_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-text-secondary">{r.reading_date}</td>
                        <td className="px-4 py-3 text-right font-mono text-text-primary">
                          {r.reading_value} {r.unit}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-text-secondary">
                          {r.consumption != null ? `${r.consumption} ${r.unit}` : '—'}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono font-medium ${r.charge_amount > 0 ? 'text-text-primary' : 'text-text-disabled'}`}>
                          {r.charge_amount > 0 ? formatGHS(r.charge_amount) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
