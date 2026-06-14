'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2, Palette, BedDouble, CheckCircle2,
  Loader2, ChevronRight, ChevronLeft, ArrowRight,
  Globe, Upload, X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ColorPickerField } from './color-picker'

/* ── Types ─────────────────────────────────────────────────────────── */

interface FormData {
  // Step 1: Identity
  name:           string
  slug:           string
  custom_domain:  string
  tagline:        string
  contact_phone:  string
  contact_email:  string
  address_city:   string
  address_region: string
  currency:       string
  timezone:       string
  // Step 2: Branding
  primary_color:  string
  logo_url:       string
  // Step 3: Rooms
  category_name:  string
  category_type:  'single' | 'double' | 'triple' | 'quad' | 'dormitory' | 'suite' | 'studio' | 'shared'
  base_rate_ghs:  string
  rate_unit:      'night' | 'week' | 'month' | 'semester'
  capacity:       string
  room_number:    string
  block:          string
  floor:          string
}

type StepKey = 'identity' | 'branding' | 'rooms' | 'done'

const STEPS: { key: StepKey; label: string; icon: React.ElementType }[] = [
  { key: 'identity', label: 'Your hostel',  icon: Building2    },
  { key: 'branding', label: 'Branding',     icon: Palette      },
  { key: 'rooms',    label: 'Room setup',   icon: BedDouble    },
  { key: 'done',     label: 'All set!',     icon: CheckCircle2 },
]

const ROOM_TYPES = [
  { value: 'single',    label: 'Single'    },
  { value: 'double',    label: 'Double'    },
  { value: 'triple',    label: 'Triple'    },
  { value: 'quad',      label: 'Quad'      },
  { value: 'dormitory', label: 'Dormitory' },
  { value: 'suite',     label: 'Suite'     },
  { value: 'studio',    label: 'Studio'    },
  { value: 'shared',    label: 'Shared'    },
]

const RATE_UNITS = [
  { value: 'night',    label: 'Per night'    },
  { value: 'week',     label: 'Per week'     },
  { value: 'month',    label: 'Per month'    },
  { value: 'semester', label: 'Per semester' },
]

const CURRENCIES = [
  { value: 'GHS', label: 'GHS — Ghana Cedi' },
  { value: 'USD', label: 'USD — US Dollar'  },
  { value: 'NGN', label: 'NGN — Naira'      },
  { value: 'KES', label: 'KES — Kenyan Shilling' },
]

const TIMEZONES = [
  { value: 'Africa/Accra',    label: 'Africa/Accra (GMT+0)'    },
  { value: 'Africa/Lagos',    label: 'Africa/Lagos (GMT+1)'    },
  { value: 'Africa/Nairobi',  label: 'Africa/Nairobi (GMT+3)'  },
  { value: 'Africa/Johannesburg', label: 'Africa/Johannesburg (GMT+2)' },
  { value: 'Europe/London',   label: 'Europe/London'           },
]

const GHANA_REGIONS = [
  'Ahafo',
  'Ashanti',
  'Bono',
  'Bono East',
  'Central',
  'Eastern',
  'Greater Accra',
  'North East',
  'Northern',
  'Oti',
  'Savannah',
  'Upper East',
  'Upper West',
  'Volta',
  'Western',
  'Western North',
]


/* ── Helpers ───────────────────────────────────────────────────────── */

const inputCls = 'w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text-primary placeholder-text-tertiary focus:border-brand focus:outline-none transition-colors'
const labelCls = 'block text-sm font-medium text-text-primary mb-1'
const hintCls  = 'text-xs text-text-secondary mt-0.5'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
      {hint && <p className={hintCls}>{hint}</p>}
    </div>
  )
}

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
}

/* ── Main component ─────────────────────────────────────────────────── */

interface InitialIdentity {
  name:           string
  slug:           string
  custom_domain:  string
  tagline:        string
  contact_phone:  string
  contact_email:  string
  address_city:   string
  address_region: string
  currency:       string
  timezone:       string
  primary_color:  string
  logo_url:       string
}

interface OnboardingWizardProps {
  tenantId: string
  initial:  InitialIdentity
}

export function OnboardingWizard({ tenantId, initial }: OnboardingWizardProps) {
  const router = useRouter()
  const appDomain = (process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'gh-hostels.com')
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')

  const [stepIdx,        setStepIdx]        = useState(0)
  const [submitting,     setSubmitting]     = useState(false)
  const [savingIdentity, setSavingIdentity] = useState(false)
  const [error,          setError]          = useState('')
  const [finalSlug,      setFinalSlug]      = useState(initial.slug)
  const [finalPlan,      setFinalPlan]      = useState<'starter' | 'growth' | 'trial' | null>(null)
  const [finalInterval,  setFinalInterval]  = useState<string | null>(null)

  // Slug check state
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const slugTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Logo upload state
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoFileName,  setLogoFileName]  = useState('')
  const [logoError,     setLogoError]     = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<FormData>({
    name:           initial.name,
    slug:           initial.slug,
    custom_domain:  initial.custom_domain,
    tagline:        initial.tagline,
    contact_phone:  initial.contact_phone,
    contact_email:  initial.contact_email,
    address_city:   initial.address_city,
    address_region: initial.address_region,
    currency:       initial.currency,
    timezone:       initial.timezone,
    primary_color:  initial.primary_color,
    logo_url:       initial.logo_url,
    category_name:  'Standard Room',
    category_type:  'single',
    base_rate_ghs:  '',
    rate_unit:      'semester',
    capacity:       '1',
    room_number:    '101',
    block:          '',
    floor:          '',
  })

  const currentStep = STEPS[stepIdx]

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function next() { setStepIdx((i) => Math.min(i + 1, STEPS.length - 1)) }
  function back() { setStepIdx((i) => Math.max(i - 1, 0)) }

  async function saveIdentityAndContinue() {
    setError('')
    setSavingIdentity(true)
    try {
      const res = await fetch('/api/onboarding/identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          name:           form.name.trim(),
          slug:           form.slug,
          custom_domain:  form.custom_domain.trim() || null,
          tagline:        form.tagline.trim() || null,
          contact_phone:  form.contact_phone.trim() || null,
          contact_email:  form.contact_email.trim() || null,
          address_city:   form.address_city.trim() || null,
          address_region: form.address_region.trim() || null,
          currency:       form.currency,
          timezone:       form.timezone,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.error === 'slug_taken') { setError('That URL is already taken — pick a different slug.'); return }
        if (data.error === 'domain_taken') { setError('That custom domain is already registered to another hostel.'); return }
        throw new Error(typeof data.error === 'string' ? data.error : 'Could not save. Try again.')
      }
      next()
    } catch (e: any) {
      setError(e?.message ?? 'Network error — try again.')
    } finally {
      setSavingIdentity(false)
    }
  }

  // Auto-generate slug when hostel name changes (identity step only)
  function handleNameChange(name: string) {
    set('name', name)
    const slug = toSlug(name)
    set('slug', slug)
    checkSlug(slug)
  }

  function handleSlugChange(raw: string) {
    const slug = raw.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40)
    set('slug', slug)
    checkSlug(slug)
  }

  function checkSlug(slug: string) {
    if (slugTimer.current) clearTimeout(slugTimer.current)
    if (slug.length < 2) { setSlugStatus('idle'); return }
    setSlugStatus('checking')
    slugTimer.current = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/onboarding/check-slug?slug=${encodeURIComponent(slug)}&excludeId=${tenantId}`)
        const data = await res.json()
        setSlugStatus(data.available ? 'available' : 'taken')
      } catch {
        setSlugStatus('idle')
      }
    }, 500)
  }

  // Check initial slug on mount
  useEffect(() => {
    if (initial.slug) checkSlug(initial.slug)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleLogoUpload(file: File) {
    if (!file || !tenantId) return
    setLogoUploading(true)
    setLogoFileName('')
    setLogoError('')
    try {
      const supabase = createClient()
      const ext  = file.name.split('.').pop()
      const path = `${tenantId}-${Date.now()}.${ext}`
      const { data, error } = await supabase.storage
        .from('tenant-logos')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (error) throw error

      const { data: { publicUrl } } = supabase.storage.from('tenant-logos').getPublicUrl(data.path)
      set('logo_url', publicUrl)
      setLogoFileName(file.name)
    } catch (e: any) {
      setLogoError(e?.message ?? 'Upload failed. You can add your logo later in Settings → Branding.')
    } finally {
      setLogoUploading(false)
    }
  }

  async function submit() {
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/onboarding/complete', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          name:           form.name.trim(),
          slug:           form.slug,
          custom_domain:  form.custom_domain.trim() || null,
          tagline:        form.tagline.trim() || null,
          contact_phone:  form.contact_phone.trim() || null,
          contact_email:  form.contact_email.trim() || null,
          address_city:   form.address_city.trim() || null,
          address_region: form.address_region.trim() || null,
          currency:       form.currency,
          timezone:       form.timezone,
          primary_color:  form.primary_color,
          logo_url:       form.logo_url || null,
          category_name:  form.category_name.trim(),
          category_type:  form.category_type,
          base_rate:      Math.round(parseFloat(form.base_rate_ghs || '0') * 100),
          rate_unit:      form.rate_unit,
          capacity:       parseInt(form.capacity) || 1,
          room_number:    form.room_number.trim(),
          block:          form.block.trim() || null,
          floor:          form.floor ? parseInt(form.floor) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'slug_taken') { setError('That URL slug is already taken. Go back and choose a different one.'); return }
        throw new Error(typeof data.error === 'string' ? data.error : 'Setup failed')
      }
      setFinalSlug(data.slug ?? form.slug)
      setFinalPlan(data.selected_plan ?? null)
      setFinalInterval(data.selected_interval ?? null)
      next() // → done
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const isLocalhost = appDomain === 'localhost' || appDomain === '127.0.0.1'

  const isPaidPlan = finalPlan === 'starter' || finalPlan === 'growth'

  function getDashboardUrl() {
    const billingQs = finalInterval ? `&billing=${finalInterval}` : ''
    const path = isPaidPlan ? `/settings/billing?autosubscribe=${finalPlan}${billingQs}` : '/dashboard'
    if (isLocalhost) return path
    return `https://${finalSlug}.${appDomain}${path}`
  }

  function getBookingUrl() {
    if (isLocalhost) return '/book'
    return `https://${finalSlug}.${appDomain}/book`
  }

  return (
    <div className="min-h-screen bg-surface-raised flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">

        {/* Progress bar */}
        {currentStep.key !== 'done' && (
          <div className="mb-8">
            <div className="flex items-center gap-1 mb-3">
              {STEPS.filter((s) => s.key !== 'done').map((s, i) => (
                <div
                  key={s.key}
                  className={`flex-1 h-1.5 rounded-full transition-all ${i <= stepIdx ? 'bg-brand' : 'bg-border'}`}
                />
              ))}
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-text-secondary">
                Step {stepIdx + 1} of {STEPS.length - 1} —{' '}
                <span className="font-medium text-text-primary">{currentStep.label}</span>
              </p>
              <p className="text-[11px] text-text-tertiary">~3 minutes total · auto-saved</p>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-surface shadow-sm p-8 space-y-6">

          {/* ── Step 1: Identity ─────────────────────────────────────── */}
          {currentStep.key === 'identity' && (
            <>
              <StepHeader icon={Building2} title="Tell us about your hostel" sub="This information appears on invoices, receipts, and your public booking page." />

              <div className="space-y-4">
                {/* Hostel name */}
                <Field label="Hostel name *">
                  <input
                    className={inputCls}
                    value={form.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Acacia Hostel"
                    maxLength={120}
                  />
                </Field>

                {/* Slug + URL preview */}
                <Field label="Your URL" hint="Lowercase letters, numbers, and hyphens only">
                  <div className="flex items-center rounded-lg border border-border overflow-hidden focus-within:border-brand transition-colors">
                    <span className="px-3 py-2.5 text-sm bg-surface-sunken text-text-secondary border-r border-border whitespace-nowrap">
                      {isLocalhost ? 'localhost:3000/' : `${appDomain}/`}
                    </span>
                    <input
                      className="flex-1 px-3 py-2.5 text-sm bg-surface text-text-primary font-mono focus:outline-none"
                      value={form.slug}
                      onChange={(e) => handleSlugChange(e.target.value)}
                      placeholder="acacia-hostel"
                      maxLength={40}
                    />
                    <div className="px-3">
                      {slugStatus === 'checking'  && <Loader2 className="h-4 w-4 animate-spin text-text-disabled" />}
                      {slugStatus === 'available' && <CheckCircle className="h-4 w-4 text-success" />}
                      {slugStatus === 'taken'     && <XCircle className="h-4 w-4 text-danger" />}
                    </div>
                  </div>
                  {slugStatus === 'taken' && (
                    <p className="text-xs text-danger mt-1">This URL is already taken — try a different slug.</p>
                  )}
                  {slugStatus === 'available' && (
                    <p className="text-xs text-success mt-1">This URL is available.</p>
                  )}
                </Field>

                <Field label="Tagline (optional)" hint="One sentence shown on invoices and your booking page">
                  <input className={inputCls} value={form.tagline} onChange={(e) => set('tagline', e.target.value)} placeholder="Modern rooms, fast WiFi, 24/7 security" maxLength={200} />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Contact phone (optional)">
                    <input type="tel" className={inputCls} value={form.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} placeholder="0244 000 000" maxLength={30} />
                  </Field>
                  <Field label="Contact email (optional)">
                    <input type="email" className={inputCls} value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} placeholder="info@hostel.com" maxLength={120} />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="City / Town (optional)">
                    <input className={inputCls} value={form.address_city} onChange={(e) => set('address_city', e.target.value)} placeholder="Kumasi" maxLength={100} />
                  </Field>
                  <Field label="Region (optional)">
                    <select className={inputCls} value={form.address_region} onChange={(e) => set('address_region', e.target.value)}>
                      <option value="">Select region…</option>
                      {GHANA_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Currency">
                    <select className={inputCls} value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                      {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Timezone">
                    <select className={inputCls} value={form.timezone} onChange={(e) => set('timezone', e.target.value)}>
                      {TIMEZONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </Field>
                </div>

                {/* Custom domain */}
                <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-brand shrink-0" />
                    <p className="text-sm font-semibold text-text-primary">Custom domain <span className="text-xs font-normal text-text-secondary">(optional — configure DNS later)</span></p>
                  </div>
                  <input
                    className={inputCls + ' font-mono'}
                    value={form.custom_domain}
                    onChange={(e) => set('custom_domain', e.target.value.toLowerCase().replace(/\s/g, ''))}
                    placeholder="admin.yourhostel.com"
                    maxLength={253}
                  />
                  <p className="text-xs text-text-secondary">
                    Your app will live at this domain — no &quot;gh-hostels&quot; in the URL. You&apos;ll get DNS setup instructions after finishing setup.
                  </p>
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</div>
              )}

              <NavButtons
                onNext={saveIdentityAndContinue}
                nextLabel={savingIdentity ? 'Saving…' : 'Continue'}
                nextIcon={savingIdentity ? Loader2 : ChevronRight}
                nextIconSpin={savingIdentity}
                nextDisabled={savingIdentity || !form.name.trim() || form.slug.length < 2 || slugStatus === 'taken' || slugStatus === 'checking'}
              />
            </>
          )}

          {/* ── Step 2: Branding ─────────────────────────────────────── */}
          {currentStep.key === 'branding' && (
            <>
              <StepHeader icon={Palette} title="Brand your hostel" sub="Your logo and colours appear on your booking page, invoices, and login screen." />

              <div className="space-y-5">
                {/* Logo upload */}
                <Field label="Logo" hint="PNG or JPG, recommended 200×200px or larger">
                  <div className="flex items-center gap-3">
                    {form.logo_url ? (
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={form.logo_url} alt="Logo" className="h-14 w-14 rounded-xl object-contain border border-border" />
                        <button
                          onClick={() => { set('logo_url', ''); setLogoFileName('') }}
                          className="absolute -top-1.5 -right-1.5 rounded-full bg-danger text-white p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-border text-text-disabled"
                        style={{ backgroundColor: form.primary_color + '20' }}
                      >
                        <span className="font-bold text-xl" style={{ color: form.primary_color }}>
                          {form.name?.[0]?.toUpperCase() ?? 'H'}
                        </span>
                      </div>
                    )}
                    <div className="flex-1">
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        disabled={logoUploading}
                        className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-text-secondary hover:bg-surface-raised transition-colors disabled:opacity-50"
                      >
                        {logoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        {logoUploading ? 'Uploading…' : 'Upload logo'}
                      </button>
                      {logoFileName ? (
                        <p className="mt-1 flex items-center gap-1 text-xs text-success font-medium">
                          <CheckCircle2 className="h-3 w-3 shrink-0" />
                          {logoFileName}
                        </p>
                      ) : logoError ? (
                        <p className="mt-1 text-xs text-danger">{logoError}</p>
                      ) : (
                        <p className="text-xs text-text-tertiary mt-1">Or add it later in Settings → Branding</p>
                      )}
                    </div>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f) }}
                    />
                  </div>
                </Field>

                {/* Colour picker */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">Primary colour</label>
                  <ColorPickerField
                    value={form.primary_color}
                    onChange={(c) => set('primary_color', c)}
                  />
                </div>

                {/* Live preview */}
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="h-2" style={{ backgroundColor: form.primary_color }} />
                  <div className="p-4 flex items-center gap-3">
                    {form.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={form.logo_url} alt="Logo" className="h-10 w-10 rounded-lg object-contain" />
                    ) : (
                      <div className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ backgroundColor: form.primary_color }}>
                        {form.name?.[0]?.toUpperCase() ?? 'H'}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{form.name || 'Your Hostel'}</p>
                      <p className="text-xs text-text-secondary">{form.tagline || 'Your booking page'}</p>
                    </div>
                  </div>
                  <div className="px-4 pb-4">
                    <div className="rounded-lg py-2 text-center text-xs text-white font-semibold" style={{ backgroundColor: form.primary_color }}>
                      Book a room
                    </div>
                  </div>
                </div>
              </div>

              <NavButtons onBack={back} onNext={next} />
            </>
          )}

          {/* ── Step 3: Room Setup ───────────────────────────────────── */}
          {currentStep.key === 'rooms' && (
            <>
              <StepHeader icon={BedDouble} title="Set up your first room" sub="You can add more rooms and categories after setup. One is enough to take your first booking." />

              <div className="space-y-5">
                {/* Room category */}
                <div className="rounded-xl border border-border bg-surface-sunken p-4 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Room Category</p>

                  <Field label="Category name *">
                    <input className={inputCls} value={form.category_name} onChange={(e) => set('category_name', e.target.value)} placeholder="Standard Single" maxLength={80} />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Room type *">
                      <select className={inputCls} value={form.category_type} onChange={(e) => set('category_type', e.target.value as FormData['category_type'])}>
                        {ROOM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Capacity (people) *">
                      <input type="number" min={1} max={20} className={inputCls} value={form.capacity} onChange={(e) => set('capacity', e.target.value)} />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label={`Price (${form.currency}) *`}>
                      <input type="number" min={0} step={0.01} className={inputCls} value={form.base_rate_ghs} onChange={(e) => set('base_rate_ghs', e.target.value)} placeholder="1200.00" />
                    </Field>
                    <Field label="Billing unit *">
                      <select className={inputCls} value={form.rate_unit} onChange={(e) => set('rate_unit', e.target.value as FormData['rate_unit'])}>
                        {RATE_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                      </select>
                    </Field>
                  </div>
                </div>

                {/* First room */}
                <div className="rounded-xl border border-border bg-surface-sunken p-4 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">First Room</p>

                  <Field label="Room number *" hint="e.g. 101, A1, G-01">
                    <input className={inputCls} value={form.room_number} onChange={(e) => set('room_number', e.target.value)} placeholder="101" maxLength={20} />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Block / Wing" hint="Optional">
                      <input className={inputCls} value={form.block} onChange={(e) => set('block', e.target.value)} placeholder="Block A" maxLength={50} />
                    </Field>
                    <Field label="Floor" hint="Optional (0 = ground)">
                      <input type="number" min={0} max={100} className={inputCls} value={form.floor} onChange={(e) => set('floor', e.target.value)} placeholder="1" />
                    </Field>
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</div>
              )}

              <NavButtons
                onBack={back}
                nextLabel={submitting ? 'Setting up…' : 'Finish setup'}
                nextIcon={submitting ? Loader2 : ArrowRight}
                nextIconSpin={submitting}
                onNext={submit}
                nextDisabled={submitting || !form.category_name.trim() || !form.base_rate_ghs || parseFloat(form.base_rate_ghs) <= 0 || !form.room_number.trim()}
              />
            </>
          )}

          {/* ── Step 4: Done ─────────────────────────────────────────── */}
          {currentStep.key === 'done' && (
            <div className="space-y-5 py-2">
              {/* Header */}
              <div className="text-center space-y-3">
                <div className="flex justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                    <CheckCircle2 className="h-8 w-8 text-success" />
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-text-primary">You&apos;re all set!</h2>
                  <p className="mt-1 text-sm text-text-secondary">
                    <strong>{form.name}</strong> is ready. One last thing — connect your domain.
                  </p>
                </div>
              </div>

              {/* Custom domain DNS setup (primary focus) */}
              {form.custom_domain ? (
                <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-brand shrink-0" />
                    <p className="text-sm font-semibold text-text-primary">
                      Connect <span className="font-mono">{form.custom_domain}</span>
                    </p>
                  </div>
                  <p className="text-xs text-text-secondary">
                    Add this DNS record at your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.):
                  </p>
                  <div className="overflow-x-auto rounded-lg border border-border bg-surface">
                    <table className="w-full text-xs">
                      <thead className="border-b border-border bg-surface-raised">
                        <tr>
                          {['Type', 'Name / Host', 'Value / Points to', 'TTL'].map(h => (
                            <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="px-3 py-2 font-mono font-bold text-text-primary">CNAME</td>
                          <td className="px-3 py-2 font-mono text-text-primary">
                            {form.custom_domain.split('.').length > 2
                              ? form.custom_domain.split('.')[0]
                              : '@'}
                          </td>
                          <td className="px-3 py-2 font-mono text-text-primary">cname.vercel-dns.com</td>
                          <td className="px-3 py-2 text-text-secondary">3600</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-text-tertiary">
                    DNS changes take 24–48 hours to propagate. Until then, use the temporary URL below.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-surface-sunken p-4 flex items-start gap-3">
                  <Globe className="h-4 w-4 text-text-secondary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-text-primary">No custom domain yet</p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      Go to <strong>Settings → Custom Domain</strong> to connect your own domain and remove &quot;gh-hostels&quot; from the URL.
                    </p>
                  </div>
                </div>
              )}

              {/* Working URLs */}
              <div className="rounded-xl border border-border bg-surface divide-y divide-border text-left">
                <div className="flex items-start gap-3 px-4 py-3">
                  <div className="mt-0.5 shrink-0">
                    {form.custom_domain
                      ? <span className="text-[10px] font-bold uppercase text-warning bg-warning/10 border border-warning/20 rounded px-1.5 py-0.5">Pending DNS</span>
                      : <span className="text-[10px] font-bold uppercase text-success bg-success/10 border border-success/20 rounded px-1.5 py-0.5">Active</span>
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-text-tertiary mb-0.5">
                      {form.custom_domain ? 'Your custom domain (after DNS propagates)' : 'Your booking page'}
                    </p>
                    <span className="font-mono text-xs text-brand truncate block">
                      {form.custom_domain ? `https://${form.custom_domain}` : getBookingUrl()}
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-0.5 shrink-0 text-[10px] font-bold uppercase text-success bg-success/10 border border-success/20 rounded px-1.5 py-0.5">Active</span>
                  <div className="min-w-0">
                    <p className="text-xs text-text-tertiary mb-0.5">Temporary subdomain (always works)</p>
                    <a href={getDashboardUrl()} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-text-secondary hover:underline truncate block">
                      {getDashboardUrl()}
                    </a>
                  </div>
                </div>
              </div>

              {/* Next steps */}
              <div className="rounded-xl border border-border bg-surface-raised px-4 py-3 space-y-1.5 text-xs text-text-secondary">
                <p className="font-medium text-text-primary text-sm">Suggested next steps</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Add more rooms under <strong>Rooms → Add room</strong></li>
                  <li>Register your first occupant under <strong>Occupants</strong></li>
                  <li>Take your first booking under <strong>Bookings → New booking</strong></li>
                  <li>Upload your logo at <strong>Settings → Branding</strong></li>
                  <li>Invite staff under <strong>Staff → Invite member</strong></li>
                </ul>
              </div>

              <button
                onClick={() => {
                  const url = getDashboardUrl()
                  if (isLocalhost) router.push(url)
                  else window.location.href = url
                }}
                className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: form.primary_color }}
              >
                {isPaidPlan ? `Subscribe to ${finalPlan}` : 'Go to dashboard'}
                <ArrowRight className="inline h-4 w-4 ml-1" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Sub-components ─────────────────────────────────────────────────── */

function StepHeader({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10">
        <Icon className="h-5 w-5 text-brand" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-text-primary">{title}</h2>
        <p className="mt-0.5 text-sm text-text-secondary">{sub}</p>
      </div>
    </div>
  )
}

function CheckCircle({ className }: { className?: string }) {
  return <CheckCircle2 className={className} />
}

function XCircle({ className }: { className?: string }) {
  return <X className={className} />
}

function NavButtons({
  onBack,
  onNext,
  nextLabel = 'Continue',
  nextIcon: NextIcon = ChevronRight,
  nextIconSpin = false,
  nextDisabled = false,
}: {
  onBack?: () => void
  onNext?: () => void
  nextLabel?: string
  nextIcon?: React.ElementType
  nextIconSpin?: boolean
  nextDisabled?: boolean
}) {
  return (
    <div className="flex gap-3 pt-2">
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-surface-raised transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
      )}
      {onNext && (
        <button
          onClick={onNext}
          disabled={nextDisabled}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {nextLabel}
          <NextIcon className={`h-4 w-4 ${nextIconSpin ? 'animate-spin' : ''}`} />
        </button>
      )}
    </div>
  )
}
