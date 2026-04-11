'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const ENTITIES = [
  { value: 'bookings',    label: 'Bookings',     desc: 'All bookings with occupant, room, and payment info' },
  { value: 'occupants',   label: 'Occupants',    desc: 'All occupant profiles with academic details' },
  { value: 'payments',    label: 'Payments',     desc: 'All payment records with booking references' },
  { value: 'maintenance', label: 'Maintenance',  desc: 'All maintenance requests by status and category' },
  { value: 'expenses',    label: 'Expenses',     desc: 'All operational expenses by category' },
]

export function ExportClient() {
  const [from, setFrom]         = useState('')
  const [to, setTo]             = useState('')
  const [loading, setLoading]   = useState<string | null>(null)

  async function download(entity: string) {
    setLoading(entity)
    try {
      const params = new URLSearchParams({ entity })
      if (from) params.set('from', from)
      if (to)   params.set('to', to)
      const res = await fetch(`/api/export?${params}`)
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = res.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] ?? `${entity}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Date filter */}
      <Card>
        <CardHeader><CardTitle>Date range (optional)</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-text-tertiary">From</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-text-tertiary">To</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>
          </div>
          {(from || to) && (
            <button
              onClick={() => { setFrom(''); setTo('') }}
              className="mt-2 text-xs text-text-tertiary hover:text-danger transition-colors"
            >
              Clear filter
            </button>
          )}
        </CardContent>
      </Card>

      {/* Export cards */}
      <div className="space-y-3">
        {ENTITIES.map((e) => (
          <Card key={e.value}>
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="font-medium text-text-primary">{e.label}</p>
                <p className="text-xs text-text-tertiary mt-0.5">{e.desc}</p>
              </div>
              <button
                onClick={() => download(e.value)}
                disabled={loading === e.value}
                className="flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-60"
              >
                {loading === e.value
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Download className="h-4 w-4" />}
                CSV
              </button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
