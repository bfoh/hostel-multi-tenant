'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Upload, X, Loader2 } from 'lucide-react'

const schema = z.object({
  primary_color: z.string().optional(),
  accent_color:  z.string().optional(),
  currency:      z.string().length(3).default('GHS'),
  timezone:      z.string().default('Africa/Accra'),
})

type FormValues = z.infer<typeof schema>

interface Props {
  tenant: {
    id: string
    name: string
    slug: string
    primary_color: string | null
    accent_color:  string | null
    logo_url:      string | null
    currency:      string
    timezone:      string
  }
}

export function BrandingForm({ tenant }: Props) {
  const router = useRouter()
  const [success, setSuccess] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  // Logo upload state
  const [logoUrl, setLogoUrl] = useState<string | null>(tenant.logo_url)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting, isDirty } } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      primary_color: tenant.primary_color ?? '#1B4F72',
      accent_color:  tenant.accent_color  ?? '#F39C12',
      currency:      tenant.currency,
      timezone:      tenant.timezone,
    },
  })

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoError(null)
    setLogoUploading(true)

    const form = new FormData()
    form.append('logo', file)

    const res = await fetch('/api/settings/logo', { method: 'POST', body: form })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setLogoError(data.error ?? 'Upload failed.')
    } else {
      setLogoUrl(data.logo_url)
      router.refresh()
    }
    setLogoUploading(false)
    // Reset file input
    if (fileRef.current) fileRef.current.value = ''
  }

  async function removeLogo() {
    setLogoUrl(null)
    await fetch('/api/settings/branding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logo_url: null }),
    })
    router.refresh()
  }

  async function onSubmit(values: FormValues) {
    setServerError(null)
    const res = await fetch('/api/settings/branding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setServerError(d.error ?? 'Failed to save.')
      return
    }
    setSuccess(true)
    router.refresh()
    setTimeout(() => setSuccess(false), 3000)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>

      {/* Logo */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-text-primary">Hostel logo</p>
        <div className="flex items-center gap-4">
          {/* Preview */}
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-sunken">
            {logoUploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-text-tertiary" />
            ) : logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-full w-full object-contain p-1" />
            ) : (
              <span className="text-xl font-bold text-text-disabled">
                {tenant.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={logoUploading}
              className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-raised transition-colors disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />
              {logoUrl ? 'Replace logo' : 'Upload logo'}
            </button>
            {logoUrl && (
              <button
                type="button"
                onClick={removeLogo}
                className="flex items-center gap-2 text-xs font-medium text-danger hover:underline"
              >
                <X className="h-3 w-3" />
                Remove
              </button>
            )}
            <p className="text-[11px] text-text-disabled">PNG or SVG · Max 2 MB · Shown on invoices & receipts</p>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          className="hidden"
          onChange={handleLogoChange}
        />
        {logoError && <p className="text-xs text-danger">{logoError}</p>}
      </div>

      {/* Brand colours */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="primary_color" className="text-sm font-medium text-text-primary">
            Primary colour
          </label>
          <div className="flex items-center gap-2">
            <input
              id="primary_color"
              type="color"
              {...register('primary_color')}
              className="h-9 w-9 cursor-pointer rounded border border-border p-0.5"
            />
            <input
              type="text"
              {...register('primary_color')}
              placeholder="#1B4F72"
              className="input-base flex-1 font-mono text-sm"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="accent_color" className="text-sm font-medium text-text-primary">
            Accent colour
          </label>
          <div className="flex items-center gap-2">
            <input
              id="accent_color"
              type="color"
              {...register('accent_color')}
              className="h-9 w-9 cursor-pointer rounded border border-border p-0.5"
            />
            <input
              type="text"
              {...register('accent_color')}
              placeholder="#F39C12"
              className="input-base flex-1 font-mono text-sm"
            />
          </div>
        </div>
      </div>

      {/* Currency & Timezone */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="currency" className="text-sm font-medium text-text-primary">Currency</label>
          <select id="currency" {...register('currency')} className="input-base">
            <option value="GHS">GHS — Ghana Cedi</option>
            <option value="USD">USD — US Dollar</option>
            <option value="EUR">EUR — Euro</option>
            <option value="GBP">GBP — Pound Sterling</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="timezone" className="text-sm font-medium text-text-primary">Timezone</label>
          <select id="timezone" {...register('timezone')} className="input-base">
            <option value="Africa/Accra">Africa/Accra (GMT+0)</option>
            <option value="Africa/Lagos">Africa/Lagos (GMT+1)</option>
            <option value="Europe/London">Europe/London</option>
            <option value="America/New_York">America/New_York</option>
          </select>
        </div>
      </div>

      {serverError && <div className="rounded-md bg-danger-subtle px-3 py-2 text-sm text-danger">{serverError}</div>}
      {success    && <div className="rounded-md bg-success-subtle px-3 py-2 text-sm text-success">Branding saved.</div>}

      <button
        type="submit"
        disabled={isSubmitting || !isDirty}
        className="rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-50"
      >
        {isSubmitting ? 'Saving…' : 'Save branding'}
      </button>
    </form>
  )
}
