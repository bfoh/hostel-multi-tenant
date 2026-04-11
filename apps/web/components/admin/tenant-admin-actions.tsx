'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  tenantId: string
  tenantSlug: string
  currentStatus: string
}

export function TenantAdminActions({ tenantId, tenantSlug, currentStatus }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function changeStatus(newStatus: string) {
    setLoading(newStatus)
    setError(null)
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const j = await res.json()
        setError(j.error ?? 'Failed to update status')
      } else {
        router.refresh()
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(null)
    }
  }

  async function impersonate() {
    setLoading('impersonate')
    setError(null)
    try {
      const res = await fetch(`/api/admin/impersonate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, tenantSlug }),
      })
      if (!res.ok) {
        const j = await res.json()
        setError(j.error ?? 'Failed to impersonate')
      } else {
        // Redirect to dashboard as this tenant
        window.location.href = '/dashboard'
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
      <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wide">Actions</h2>

      {error && (
        <p className="rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-400">{error}</p>
      )}

      <div className="flex flex-wrap gap-3">
        {currentStatus !== 'active' && (
          <button
            onClick={() => changeStatus('active')}
            disabled={loading !== null}
            className="rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white transition-colors"
          >
            {loading === 'active' ? 'Activating…' : 'Activate'}
          </button>
        )}

        {currentStatus !== 'suspended' && (
          <button
            onClick={() => changeStatus('suspended')}
            disabled={loading !== null}
            className="rounded-lg bg-red-800 hover:bg-red-700 disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white transition-colors"
          >
            {loading === 'suspended' ? 'Suspending…' : 'Suspend'}
          </button>
        )}

        {currentStatus !== 'trial' && (
          <button
            onClick={() => changeStatus('trial')}
            disabled={loading !== null}
            className="rounded-lg bg-yellow-700 hover:bg-yellow-600 disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white transition-colors"
          >
            {loading === 'trial' ? 'Reverting…' : 'Revert to Trial'}
          </button>
        )}

        <button
          onClick={impersonate}
          disabled={loading !== null}
          className="rounded-lg border border-white/20 hover:border-white/40 disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white/70 hover:text-white transition-colors"
        >
          {loading === 'impersonate' ? 'Loading…' : 'Impersonate (View as tenant)'}
        </button>
      </div>

      <p className="text-xs text-white/25">
        Impersonation overlays this tenant&apos;s context in your session. Clear it by logging out or visiting /admin/impersonate/clear.
      </p>
    </div>
  )
}
