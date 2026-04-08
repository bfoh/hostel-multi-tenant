'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  tenant: {
    sms_enabled:   boolean
    email_enabled: boolean
    momo_enabled:  boolean
  }
}

interface Toggle {
  key: keyof Props['tenant']
  label: string
  description: string
}

const TOGGLES: Toggle[] = [
  {
    key: 'sms_enabled',
    label: 'SMS notifications',
    description: 'Send SMS to occupants on booking confirmation, payment received, and overdue reminders.',
  },
  {
    key: 'email_enabled',
    label: 'Email notifications',
    description: 'Send emails for invoices, receipts, and booking confirmations.',
  },
  {
    key: 'momo_enabled',
    label: 'Mobile Money payments',
    description: 'Enable MTN MoMo, Vodafone Cash, and AirtelTigo as payment channels via Paystack.',
  },
]

export function NotificationsForm({ tenant }: Props) {
  const router = useRouter()
  const [values, setValues] = useState({
    sms_enabled:   tenant.sms_enabled,
    email_enabled: tenant.email_enabled,
    momo_enabled:  tenant.momo_enabled,
  })
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function toggle(key: keyof typeof values) {
    const next = { ...values, [key]: !values[key] }
    setValues(next)
    setSaving(key)
    setError(null)

    const res = await fetch('/api/settings/branding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: next[key] }),
    })

    if (!res.ok) {
      setValues(values) // revert
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Failed to save.')
    } else {
      router.refresh()
    }
    setSaving(null)
  }

  return (
    <div className="space-y-3">
      {TOGGLES.map((t) => (
        <label
          key={t.key}
          className="flex cursor-pointer items-start gap-4 rounded-xl border border-border bg-surface p-4 hover:bg-surface-raised transition-colors"
        >
          <div className="flex-1">
            <p className="text-sm font-medium text-text-primary">{t.label}</p>
            <p className="mt-0.5 text-xs text-text-secondary">{t.description}</p>
          </div>

          {/* Toggle switch */}
          <button
            type="button"
            role="switch"
            aria-checked={values[t.key]}
            disabled={saving === t.key}
            onClick={() => toggle(t.key)}
            className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
              values[t.key] ? 'bg-brand' : 'bg-border'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
                values[t.key] ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </label>
      ))}

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
