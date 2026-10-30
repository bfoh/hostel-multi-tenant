'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle2, XCircle, Loader2, BadgeCheck } from 'lucide-react'

import { PasswordInput } from '@/components/ui/password-input'
import {
  AuthAlert,
  AuthDivider,
  AuthHeading,
  AuthStatusIcon,
  FieldError,
  authInputClass,
  authLabelClass,
  authLinkClass,
  authPrimaryButtonClass,
  fieldA11y,
} from '@/components/auth/auth-ui'

const VALID_PLANS = ['starter', 'growth', 'hotel_starter', 'hotel_growth', 'trial'] as const
type SelectedPlan = typeof VALID_PLANS[number]
const VALID_INTERVALS = ['monthly', 'quarterly', 'biannual', 'annual'] as const
type SelectedInterval = typeof VALID_INTERVALS[number]
const VALID_BUSINESS_TYPES = ['hostel', 'hotel'] as const
type BusinessType = typeof VALID_BUSINESS_TYPES[number]
// Prices here are duplicated from lib/platform-plans.ts (pre-existing drift,
// not introduced by the hotel additions — see that file's own note on the
// three-copies-of-pricing-numbers issue). Hotel prices are placeholders,
// approved 2026-09-25 pending real market data.
const PLAN_LABEL: Record<SelectedPlan, string> = {
  starter:       'Starter — GH₵ 800 / month',
  growth:        'Growth — GH₵ 1,000 / month',
  hotel_starter: 'Hotel Starter — GH₵ 1,200 / month',
  hotel_growth:  'Hotel Growth — GH₵ 1,600 / month',
  trial:         '30-day free trial',
}

const schema = z
  .object({
    hostelName: z.string().min(2, 'Hostel name must be at least 2 characters'),
    email: z.string().email('Enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Include at least one uppercase letter')
      .regex(/[0-9]/, 'Include at least one number'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type FormValues = z.infer<typeof schema>

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
}

export default function SignupPage() {
  const router = useRouter()
  const search = useSearchParams()
  const selectedPlan = useMemo<SelectedPlan | null>(() => {
    const p = search.get('plan') as SelectedPlan | null
    return p && (VALID_PLANS as readonly string[]).includes(p) ? p : null
  }, [search])
  const selectedInterval = useMemo<SelectedInterval | null>(() => {
    const i = search.get('billing') as SelectedInterval | null
    return i && (VALID_INTERVALS as readonly string[]).includes(i) ? i : null
  }, [search])
  const businessType = useMemo<BusinessType>(() => {
    const t = search.get('type') as BusinessType | null
    return t && (VALID_BUSINESS_TYPES as readonly string[]).includes(t) ? t : 'hostel'
  }, [search])
  const isHotel = businessType === 'hotel'
  const nounSingular    = isHotel ? 'hotel'  : 'hostel'
  const nounCapitalized = isHotel ? 'Hotel'  : 'Hostel'

  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess]         = useState(false)
  const [slugPreview, setSlugPreview] = useState('')
  const [slugStatus, setSlugStatus]   = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const hostelName = watch('hostelName', '')

  useEffect(() => {
    const slug = toSlug(hostelName)
    setSlugPreview(slug)
    if (slug.length < 2) { setSlugStatus('idle'); return }

    setSlugStatus('checking')
    const timer = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/onboarding/check-slug?slug=${encodeURIComponent(slug)}`)
        const data = await res.json()
        setSlugStatus(data.available ? 'available' : 'taken')
      } catch {
        setSlugStatus('idle')
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [hostelName])

  async function onSubmit(values: FormValues) {
    setServerError(null)

    const res = await fetch('/api/auth/signup', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email:        values.email,
        password:     values.password,
        hostelName:   values.hostelName,
        selectedPlan: selectedPlan ?? null,
        selectedInterval: selectedInterval ?? null,
        businessType,
      }),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setServerError(data.error ?? 'Something went wrong. Please try again.')
      return
    }

    setSuccess(true)
  }

  /* ── Success state ────────────────────────────────────────────── */
  if (success) {
    return (
      <div className="space-y-5 text-center" role="status">
        <AuthStatusIcon>
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </AuthStatusIcon>
        <AuthHeading
          title="Check your email"
          subtitle={<>We&apos;ve sent a confirmation link. Click it to activate your account and start setting up your {nounSingular}.</>}
        />
        <Link href="/login" className={`${authLinkClass} inline-block text-[14px]`}>
          ← Back to sign in
        </Link>
      </div>
    )
  }

  const appDomain = (process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'gh-hostels.com').replace(/^https?:\/\//, '')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3 text-center">
        <AuthHeading
          title={selectedPlan === 'trial' || !selectedPlan ? 'Start your free trial' : 'Create your account'}
          subtitle={<>Set up your {nounSingular} in minutes. {selectedPlan === 'trial' || !selectedPlan ? 'No credit card required.' : 'You\u2019ll subscribe after email confirmation.'}</>}
        />
        {selectedPlan && (
          <div className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-bd-amber/40 bg-bd-amber/10 px-3 py-1 text-[12px] font-semibold text-bd-amber-300">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {PLAN_LABEL[selectedPlan]}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {/* Hostel name */}
        <div>
          <label htmlFor="hostelName" className={`${authLabelClass} mb-1.5`}>
            {nounCapitalized} name
          </label>
          <input
            id="hostelName"
            type="text"
            autoComplete="organization"
            autoFocus
            {...register('hostelName')}
            {...fieldA11y('hostelName', !!errors.hostelName)}
            className={authInputClass}
            placeholder={isHotel ? 'Grand Plaza Hotel' : 'Acacia Hostel'}
          />
          <FieldError id="hostelName" message={errors.hostelName?.message} />

          {/* Slug preview */}
          {slugPreview.length >= 2 && (
            <div
              className="mt-2 flex items-center gap-1.5 rounded-xl border border-bd-ivory/15 bg-bd-ivory/[0.04] px-4 py-2.5 text-[13px]"
              aria-live="polite"
            >
              <span className="shrink-0 text-bd-ivory/65">Your URL:</span>
              <span className="min-w-0 truncate font-mono font-medium text-bd-ivory/90">
                {slugPreview}.{appDomain}
              </span>
              {slugStatus === 'checking' && (
                <Loader2 className="ml-auto h-3.5 w-3.5 shrink-0 animate-spin text-bd-ivory/65" aria-label="Checking availability" />
              )}
              {slugStatus === 'available' && (
                <span className="ml-auto inline-flex shrink-0 items-center gap-1 font-medium text-bd-amber">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  available
                </span>
              )}
              {slugStatus === 'taken' && (
                <span className="ml-auto inline-flex shrink-0 items-center gap-1 font-medium text-bd-coral-300">
                  <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  taken
                </span>
              )}
            </div>
          )}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className={`${authLabelClass} mb-1.5`}>
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            {...register('email')}
            {...fieldA11y('email', !!errors.email)}
            className={authInputClass}
            placeholder={isHotel ? 'kwame@grandplazahotel.com' : 'kwame@acaciahostel.com'}
          />
          <FieldError id="email" message={errors.email?.message} />
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className={`${authLabelClass} mb-1.5`}>
            Password
          </label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            {...register('password')}
            aria-invalid={!!errors.password || undefined}
            aria-describedby={errors.password ? 'password-error' : 'password-hint'}
            className={authInputClass}
            placeholder="Create a password"
            tone="dark"
          />
          {errors.password ? (
            <FieldError id="password" message={errors.password.message} />
          ) : (
            <p id="password-hint" className="mt-1.5 text-[13px] text-bd-ivory/65">
              At least 8 characters, with one uppercase letter and one number.
            </p>
          )}
        </div>

        {/* Confirm password */}
        <div>
          <label htmlFor="confirmPassword" className={`${authLabelClass} mb-1.5`}>
            Confirm password
          </label>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            {...register('confirmPassword')}
            {...fieldA11y('confirmPassword', !!errors.confirmPassword)}
            className={authInputClass}
            placeholder="Re-enter your password"
            tone="dark"
          />
          <FieldError id="confirmPassword" message={errors.confirmPassword?.message} />
        </div>

        {serverError && <AuthAlert>{serverError}</AuthAlert>}

        <button
          type="submit"
          disabled={isSubmitting || slugStatus === 'taken'}
          className={authPrimaryButtonClass}
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {isSubmitting ? 'Creating account\u2026' : 'Create account'}
        </button>

        <p className="text-center text-[12px] leading-relaxed text-bd-ivory/65">
          By signing up you agree to our{' '}
          <Link href="/terms" className="bd-focus-on-dark rounded text-bd-ivory underline underline-offset-2 hover:text-bd-amber">Terms</Link>
          {' '}and{' '}
          <Link href="/privacy" className="bd-focus-on-dark rounded text-bd-ivory underline underline-offset-2 hover:text-bd-amber">Privacy Policy</Link>.
        </p>
      </form>

      <AuthDivider />

      <p className="text-center text-[14px] text-bd-ivory/75">
        Already have an account?{' '}
        <Link href="/login" className={authLinkClass}>
          Sign in
        </Link>
      </p>
    </div>
  )
}
