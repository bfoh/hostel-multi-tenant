'use client'

import { useState } from 'react'
import { X, Plus } from 'lucide-react'

interface Props {
  tenantId: string
  initialDomains: string[]
}

export function WidgetSettingsForm({ tenantId, initialDomains }: Props) {
  const [domains, setDomains] = useState<string[]>(initialDomains)
  const [newDomain, setNewDomain] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  function addDomain() {
    const d = newDomain.trim().toLowerCase().replace(/^https?:\/\//, '')
    if (!d) return
    if (domains.includes(d)) { setNewDomain(''); return }
    setDomains([...domains, d])
    setNewDomain('')
  }

  function removeDomain(d: string) {
    setDomains(domains.filter((x) => x !== d))
  }

  async function save() {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch('/api/settings/widget', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widget_domains: domains }),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.error ?? 'Failed to save')
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Domain list */}
      {domains.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {domains.map((d) => (
            <span
              key={d}
              className="flex items-center gap-1.5 rounded-full bg-surface-raised border border-border px-3 py-1 text-xs text-text-primary"
            >
              {d}
              <button
                onClick={() => removeDomain(d)}
                className="text-text-tertiary hover:text-danger transition-colors"
                aria-label={`Remove ${d}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add domain */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newDomain}
          onChange={(e) => setNewDomain((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => e.key === 'Enter' && addDomain()}
          placeholder="yourhostel.com"
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <button
          onClick={addDomain}
          className="flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-secondary hover:bg-surface-raised transition-colors"
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <button
        onClick={save}
        disabled={saving}
        className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover transition-colors disabled:opacity-60"
      >
        {saving ? 'Saving…' : saved ? 'Saved!' : 'Save domains'}
      </button>
    </div>
  )
}
