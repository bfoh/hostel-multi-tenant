'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle2, XCircle, Loader2, Sparkles } from 'lucide-react'

import { PasswordInput } from '@/components/ui/password-input'

const HAIR = 'rgba(245,233,210,0.18)'
const IVORY = '#F5E9D2'
const IVORY_MUTED = 'rgba(245,233,210,0.6)'
const IVORY_DIM = 'rgba(245,233,210,0.4)'
const GOLD = '#D4A24C'
const GOLD_SOFT = '#F5C26B'
const GOLD_DEEP = '#B8842E'
const FOREST_DEEP = '#0A3729'

const VALID_PLANS = ['starter', 'growth', 'trial'] as const
type SelectedPlan = typeof VALID_PLANS[number]
const PLAN_LABEL: Record<SelectedPlan, string> = {
  starter: 'Starter — GH₵ 800 / month',
  growth:  'Growth — GH₵ 1,000 / month',
  trial:   '30-day free trial',
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

const inputClass =
  `w-full rounded-xl border bg-[rgba(245,233,210,0.03)] px-4 py-3 text-[14px] text-[#F5E9D2] placeholder:text-[rgba(245,233,210,0.35)] transition-all duration-200 focus:outline-none focus:border-[#D4A24C]/60 focus:bg-[rgba(212,162,76,0.05)]`
const inputBorder = { borderColor: HAIR }

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
      <div className="space-y-5 text-center">
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: 'rgba(212,162,76,0.10)', border: `1px solid ${GOLD}40` }}
        >
          <svg className="h-7 w-7" style={{ color: GOLD }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="space-y-2">
          <h2
            className="text-[20px] font-normal tracking-[-0.5px]"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif', color: IVORY }}
          >
            Check your email
          </h2>
          <p className="text-[13px] leading-relaxed max-w-[300px] mx-auto" style={{ color: IVORY_MUTED }}>
            We&apos;ve sent a confirmation link. Click it to activate your account and start setting up your hostel.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-block text-[13px] font-semibold transition-colors hover:opacity-80"
          style={{ color: GOLD }}
        >
          ← Back to sign in
        </Link>
      </div>
    )
  }

  const appDomain = (process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'gh-hostels.com').replace(/^https?:\/\//, '')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2 text-center">
        <h1
          className="text-[26px] font-normal tracking-[-0.5px]"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif', color: IVORY }}
        >
          {selectedPlan === 'trial' || !selectedPlan ? 'Start your free trial' : 'Create your account'}
        </h1>
        <p className="text-[14px]" style={{ color: IVORY_MUTED }}>
          Set up your hostel in minutes. {selectedPlan === 'trial' || !selectedPlan ? 'No credit card required.' : 'You\u2019ll subscribe after email confirmation.'}
        </p>
        {selectedPlan && (
          <div
            className="mx-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold"
            style={{ border: `1px solid ${GOLD}40`, background: `${GOLD}14`, color: GOLD_SOFT }}
          >
            <Sparkles className="h-3 w-3" />
            {PLAN_LABEL[selectedPlan]}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Hostel name */}
        <div className="space-y-1.5">
          <label htmlFor="hostelName" className="text-[13px] font-medium" style={{ color: IVORY_MUTED }}>
            Hostel name
          </label>
          <input
            id="hostelName"
            type="text"
            autoComplete="organization"
            autoFocus
            {...register('hostelName')}
            className={inputClass}
            style={inputBorder}
            placeholder="Acacia Hostel"
          />
          {errors.hostelName && (
            <p className="mt-1 text-[12px] text-[#ff6b6b]">{errors.hostelName.message}</p>
          )}

          {/* Slug preview */}
          {slugPreview.length >= 2 && (
            <div
              className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[12px]"
              style={{ border: `1px solid ${HAIR}`, background: 'rgba(245,233,210,0.02)' }}
            >
              <span style={{ color: IVORY_DIM }}>Your URL:</span>
              <span className="font-mono font-medium" style={{ color: IVORY_MUTED }}>
                {slugPreview}.{appDomain}
              </span>
              {slugStatus === 'checking' && <Loader2 className="ml-auto h-3 w-3 animate-spin" style={{ color: IVORY_DIM }} />}
              {slugStatus === 'available' && <CheckCircle2 className="ml-auto h-3.5 w-3.5" style={{ color: GOLD }} />}
              {slugStatus === 'taken' && (
                <>
                  <XCircle className="ml-auto h-3.5 w-3.5 text-[#ff6b6b]" />
                  <span className="text-[#ff6b6b] font-medium">taken</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-[13px] font-medium" style={{ color: IVORY_MUTED }}>
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            {...register('email')}
            className={inputClass}
            style={inputBorder}
            placeholder="kwame@acaciahostel.com"
          />
          {errors.email && (
            <p className="mt-1 text-[12px] text-[#ff6b6b]">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-[13px] font-medium" style={{ color: IVORY_MUTED }}>
            Password
          </label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            {...register('password')}
            className={inputClass}
            style={inputBorder}
            placeholder="Min. 8 characters, one uppercase, one number"
            tone="dark"
          />
          {errors.password && (
            <p className="mt-1 text-[12px] text-[#ff6b6b]">{errors.password.message}</p>
          )}
        </div>

        {/* Confirm password */}
        <div className="space-y-1.5">
          <label htmlFor="confirmPassword" className="text-[13px] font-medium" style={{ color: IVORY_MUTED }}>
            Confirm password
          </label>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            {...register('confirmPassword')}
            className={inputClass}
            style={inputBorder}
            placeholder="••••••••"
            tone="dark"
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-[12px] text-[#ff6b6b]">{errors.confirmPassword.message}</p>
          )}
        </div>

        {serverError && (
          <div
            className="rounded-xl px-4 py-3 text-[13px] text-[#ff8a8a]"
            style={{ border: '1px solid rgba(255,107,107,0.3)', background: 'rgba(255,107,107,0.08)' }}
          >
            {serverError}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || slugStatus === 'taken'}
          className="w-full rounded-full px-4 py-3 text-[14px] font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          style={{
            background: `linear-gradient(135deg, ${GOLD_SOFT} 0%, ${GOLD} 50%, ${GOLD_DEEP} 100%)`,
            color: FOREST_DEEP,
            boxShadow: '0 10px 28px -10px rgba(212,162,76,0.55)',
          }}
        >
          {isSubmitting ? 'Creating account\u2026' : 'Create account'}
        </button>

        <p className="text-center text-[11px]" style={{ color: IVORY_DIM }}>
          By signing up you agree to our{' '}
          <a href="#" className="underline underline-offset-2 transition-colors hover:opacity-80" style={{ color: IVORY }}>Terms</a>
          {' '}and{' '}
          <a href="#" className="underline underline-offset-2 transition-colors hover:opacity-80" style={{ color: IVORY }}>Privacy Policy</a>.
        </p>
      </form>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full" style={{ borderTop: `1px solid ${HAIR}` }} /></div>
        <div className="relative flex justify-center"><span className="px-3 text-[12px]" style={{ background: '#0A0A08', color: IVORY_DIM }}>or</span></div>
      </div>

      <p className="text-center text-[13px]" style={{ color: IVORY_MUTED }}>
        Already have an account?{' '}
        <Link href="/login" className="font-semibold transition-colors hover:opacity-80" style={{ color: GOLD }}>
          Sign in
        </Link>
      </p>
    </div>
  )
}
