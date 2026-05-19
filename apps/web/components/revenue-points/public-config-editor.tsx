'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Trash2, ExternalLink, Globe } from 'lucide-react'

type RevenuePointType =
  | 'gym' | 'sports' | 'laundry' | 'cafeteria' | 'restaurant'
  | 'mini_mart' | 'parking' | 'printing' | 'other'

interface Props {
  pointId:        string
  type:           RevenuePointType
  publicEnabled:  boolean
  config:         Record<string, any>
  tenantSlug:     string
  paystackReady:  boolean
}

interface SportsCourt {
  id:          string
  name:        string
  hourly_rate: number   // pesewas
}

export function PublicConfigEditor({
  pointId,
  type,
  publicEnabled: initialEnabled,
  config: initialConfig,
  tenantSlug,
  paystackReady,
}: Props) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(initialEnabled)
  const [config, setConfig]   = useState<Record<string, any>>(initialConfig ?? {})
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  function patch(part: Record<string, any>) {
    setConfig((c) => ({ ...c, ...part }))
  }

  async function save() {
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/revenue-points/${pointId}/public-config`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ public_enabled: enabled, public_config: config }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      setSavedAt(Date.now())
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  const visitUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/visit/${tenantSlug}/${pointId}`
      : `/visit/${tenantSlug}/${pointId}`

  return (
    <div className="rounded-xl border border-border bg-surface p-5 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Globe className="h-4 w-4" />
            Walk-in QR portal
          </h2>
          <p className="mt-0.5 text-xs text-text-secondary">
            Public page customers reach by scanning the revenue-point QR code.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4"
          />
          Enabled
        </label>
      </div>

      {!paystackReady && (
        <div className="rounded-lg border border-warning/30 bg-warning-subtle px-3 py-2 text-xs text-warning-fg">
          Connect a payout bank in Settings → Payouts before enabling walk-in payments.
        </div>
      )}

      {/* Type-specific fields */}
      <div className="space-y-4">
        {type === 'gym' && <GymFields config={config} patch={patch} />}
        {type === 'sports' && <SportsFields config={config} patch={patch} />}
        {type === 'laundry' && <LaundryFields config={config} patch={patch} />}
        {(type === 'restaurant' || type === 'cafeteria') && (
          <RestaurantFields config={config} patch={patch} />
        )}
        {!['gym','sports','laundry','restaurant','cafeteria'].includes(type) && (
          <p className="text-xs text-text-tertiary">
            Walk-in flow is not configured for this revenue-point type yet.
          </p>
        )}
      </div>

      {/* Live URL */}
      <div className="space-y-1.5 rounded-lg border border-border bg-surface-raised px-3 py-2">
        <p className="text-[10px] uppercase tracking-wide text-text-tertiary">Public URL</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate text-xs text-text-secondary">{visitUrl}</code>
          <a
            href={visitUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium text-text-primary hover:bg-surface-sunken transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            Open
          </a>
        </div>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex items-center justify-between">
        <p className="text-[11px] text-text-tertiary">
          {savedAt ? `Saved ${new Date(savedAt).toLocaleTimeString()}` : 'Unsaved changes'}
        </p>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 rounded-md bg-brand px-4 py-1.5 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-60"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save
        </button>
      </div>
    </div>
  )
}

/* ── Type-specific fields ──────────────────────────────────────────────── */

function NumberField({
  label, value, onChange, step = '1', hint, prefix,
}: {
  label: string
  value: number | undefined
  onChange: (n: number) => void
  step?: string
  hint?: string
  prefix?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-text-secondary">{label}</label>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-text-tertiary">{prefix}</span>
        )}
        <input
          type="number"
          step={step}
          min={0}
          value={value ?? ''}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`w-full rounded-lg border border-border bg-surface py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand ${prefix ? 'pl-10 pr-3' : 'px-3'}`}
        />
      </div>
      {hint && <p className="mt-1 text-[11px] text-text-tertiary">{hint}</p>}
    </div>
  )
}

function pesewasToGHS(p: number | undefined) {
  return p !== undefined && Number.isFinite(p) ? p / 100 : undefined
}

function GymFields({
  config,
  patch,
}: {
  config: Record<string, any>
  patch: (p: Record<string, any>) => void
}) {
  return (
    <NumberField
      label="Day pass price"
      value={pesewasToGHS(config.day_pass_price)}
      onChange={(n) => patch({ day_pass_price: Math.round(n * 100) })}
      step="0.50"
      prefix="GH₵"
      hint="Single visit, valid for 24 hours from purchase."
    />
  )
}

function LaundryFields({
  config,
  patch,
}: {
  config: Record<string, any>
  patch: (p: Record<string, any>) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <NumberField
        label="Rate per kg"
        value={pesewasToGHS(config.rate_per_kg)}
        onChange={(n) => patch({ rate_per_kg: Math.round(n * 100) })}
        step="0.50"
        prefix="GH₵"
      />
      <NumberField
        label="Minimum charge"
        value={pesewasToGHS(config.min_charge)}
        onChange={(n) => patch({ min_charge: Math.round(n * 100) })}
        step="0.50"
        prefix="GH₵"
        hint="Applied when weight × rate is lower."
      />
      <NumberField
        label="Turnaround (hours)"
        value={config.turnaround_hours}
        onChange={(n) => patch({ turnaround_hours: Math.round(n) })}
        hint="Estimated pickup time shown to customer."
      />
    </div>
  )
}

function SportsFields({
  config,
  patch,
}: {
  config: Record<string, any>
  patch: (p: Record<string, any>) => void
}) {
  const courts: SportsCourt[] = Array.isArray(config.courts) ? config.courts : []

  function setCourts(next: SportsCourt[]) {
    patch({ courts: next })
  }

  function addCourt() {
    setCourts([
      ...courts,
      { id: `court-${Date.now().toString(36)}`, name: `Court ${courts.length + 1}`, hourly_rate: 0 },
    ])
  }

  function updateCourt(i: number, part: Partial<SportsCourt>) {
    const next = [...courts]
    next[i] = { ...next[i], ...part }
    setCourts(next)
  }

  function removeCourt(i: number) {
    setCourts(courts.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-3">
      <NumberField
        label="Minimum booking duration (minutes)"
        value={config.min_minutes ?? 60}
        onChange={(n) => patch({ min_minutes: Math.max(15, Math.round(n)) })}
        step="15"
      />

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-medium text-text-secondary">Courts</label>
          <button
            type="button"
            onClick={addCourt}
            className="flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium text-text-primary hover:bg-surface-raised transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add court
          </button>
        </div>
        {courts.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-text-tertiary">
            No courts yet. Add at least one before enabling.
          </p>
        ) : (
          <div className="space-y-2">
            {courts.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2">
                <input
                  value={c.name}
                  onChange={(e) => updateCourt(i, { name: e.target.value })}
                  placeholder="Court name"
                  className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                />
                <div className="relative w-36">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-text-tertiary">GH₵</span>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={c.hourly_rate / 100}
                    onChange={(e) => updateCourt(i, { hourly_rate: Math.round(Number(e.target.value) * 100) })}
                    className="w-full rounded-lg border border-border bg-surface pl-10 pr-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeCourt(i)}
                  className="rounded p-1.5 text-text-tertiary hover:bg-danger/10 hover:text-danger transition-colors"
                  aria-label="Remove court"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <p className="text-[11px] text-text-tertiary">Hourly rate; billed by the half-hour.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function RestaurantFields({
  config,
  patch,
}: {
  config: Record<string, any>
  patch: (p: Record<string, any>) => void
}) {
  const tables: string[] = Array.isArray(config.tables) ? config.tables : []
  const pickupAllowed = config.pickup_allowed !== false
  const csv = tables.join(', ')

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-text-secondary">Tables (comma-separated)</label>
        <input
          value={csv}
          onChange={(e) =>
            patch({
              tables: e.target.value
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean),
            })
          }
          placeholder="1, 2, 3, A1, A2, …"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
        />
        <p className="mt-1 text-[11px] text-text-tertiary">
          Customer selects their table when they scan. Leave blank to skip the prompt.
        </p>
      </div>

      <label className="flex items-center gap-2 text-xs text-text-secondary">
        <input
          type="checkbox"
          checked={pickupAllowed}
          onChange={(e) => patch({ pickup_allowed: e.target.checked })}
          className="h-4 w-4"
        />
        Allow takeaway orders from the same QR
      </label>
    </div>
  )
}
