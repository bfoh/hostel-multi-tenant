'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  name:           z.string().min(2, 'Hostel name is required'),
  tagline:        z.string().max(200).optional(),
  contact_phone:  z.string().max(30).optional(),
  contact_email:  z.string().email('Invalid email').optional().or(z.literal('')),
  address_line1:  z.string().max(200).optional(),
  address_city:   z.string().max(100).optional(),
  address_region: z.string().max(100).optional(),
  website_url:    z.string().url('Invalid URL').optional().or(z.literal('')),
  custom_domain:  z.string().max(253).optional().or(z.literal('')),
})

type FormValues = z.infer<typeof schema>

interface Props {
  tenant: {
    name: string
    slug: string
    custom_domain: string | null
    tagline: string | null
    contact_phone: string | null
    contact_email: string | null
    address_line1: string | null
    address_city: string | null
    address_region: string | null
    website_url: string | null
  }
}

const GHANA_REGIONS = [
  'Greater Accra', 'Ashanti', 'Western', 'Central', 'Eastern',
  'Volta', 'Northern', 'Upper East', 'Upper West', 'Brong-Ahafo',
  'Oti', 'Bono', 'Bono East', 'Ahafo', 'Savannah',
  'North East', 'Western North',
]

export function ProfileForm({ tenant }: Props) {
  const router = useRouter()
  const [success, setSuccess] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting, isDirty } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name:           tenant.name,
      tagline:        tenant.tagline ?? '',
      contact_phone:  tenant.contact_phone ?? '',
      contact_email:  tenant.contact_email ?? '',
      address_line1:  tenant.address_line1 ?? '',
      address_city:   tenant.address_city ?? '',
      address_region: tenant.address_region ?? '',
      website_url:    tenant.website_url ?? '',
      custom_domain:  tenant.custom_domain ?? '',
    },
  })

  async function onSubmit(values: FormValues) {
    setServerError(null)
    const res = await fetch('/api/settings/profile', {
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {/* Hostel name + tagline */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary">
            Hostel name <span className="text-danger">*</span>
          </label>
          <input type="text" {...register('name')} className="input-base" />
          {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary">Tagline</label>
          <input type="text" {...register('tagline')} placeholder="Your home away from home" className="input-base" />
          <p className="text-xs text-text-disabled">Appears on invoices below your hostel name.</p>
        </div>
      </div>

      {/* URLs */}
      <div className="space-y-3">
        {/* Auto subdomain — read-only */}
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-text-primary">Platform URL</p>
          <div className="flex items-center gap-2 rounded-md border border-border bg-surface-sunken px-3 py-2 text-sm text-text-tertiary select-all">
            {tenant.slug}.ghh.com
          </div>
          <p className="text-xs text-text-disabled">Auto-generated subdomain — always active, cannot be changed.</p>
        </div>

        {/* Custom domain — editable */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary">Custom domain <span className="font-normal text-text-tertiary">(optional)</span></label>
          <div className="relative">
            <input
              type="text"
              {...register('custom_domain')}
              placeholder="bookings.yourhostel.com"
              className="input-base font-mono text-sm"
            />
          </div>
          <p className="text-xs text-text-disabled">
            Point your domain's DNS CNAME to <span className="font-mono">cname.vercel-dns.com</span>, then enter it here.
            Your booking page will be accessible at both URLs.
          </p>
        </div>
      </div>

      {/* Contact details */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary">Phone number</label>
          <input type="tel" {...register('contact_phone')} placeholder="0244 000 000" className="input-base" />
          {errors.contact_phone && <p className="text-xs text-danger">{errors.contact_phone.message}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary">Email address</label>
          <input type="email" {...register('contact_email')} placeholder="info@yourhostel.com" className="input-base" />
          {errors.contact_email && <p className="text-xs text-danger">{errors.contact_email.message}</p>}
        </div>
      </div>

      {/* Address */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-text-primary">Street address</label>
        <input type="text" {...register('address_line1')} placeholder="House No. 12, Community 18" className="input-base" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary">City / Town</label>
          <input type="text" {...register('address_city')} placeholder="Tema" className="input-base" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary">Region</label>
          <select {...register('address_region')} className="input-base">
            <option value="">Select region…</option>
            {GHANA_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-text-primary">Website</label>
        <input type="url" {...register('website_url')} placeholder="https://yourhostel.com" className="input-base" />
        {errors.website_url && <p className="text-xs text-danger">{errors.website_url.message}</p>}
      </div>

      {serverError && <div className="rounded-md bg-danger-subtle px-3 py-2 text-sm text-danger">{serverError}</div>}
      {success    && <div className="rounded-md bg-success-subtle px-3 py-2 text-sm text-success">Profile saved successfully.</div>}

      <button
        type="submit"
        disabled={isSubmitting || !isDirty}
        className="rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-50"
      >
        {isSubmitting ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  )
}
