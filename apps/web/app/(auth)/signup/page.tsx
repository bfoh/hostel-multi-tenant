'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle2, XCircle, Loader2, Sparkles } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { PasswordInput } from '@/components/ui/password-input'

const FROST = 'rgba(214,235,253,0.19)'

const VALID_PLANS = ['starter', 'growth', 'pro', 'trial'] as const
type SelectedPlan = typeof VALID_PLANS[number]
const PLAN_LABEL: Record<SelectedPlan, string> = {
  starter: 'Starter — GH₵ 500 / month',
  growth:  'Growth — GH₵ 800 / month',
  pro:     'Pro — GH₵ 1,000 / month',
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
  `w-full rounded-xl border bg-white/[0.04] px-4 py-3 text-[14px] text-[#f0f0f0] placeholder:text-[#464a4d] transition-all duration-200 focus:outline-none focus:border-[#3b9eff]/50`
const inputBorder = { borderColor: FROST }

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
    const supabase = createClient()

    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          hostel_name: values.hostelName,
          ...(selectedPlan ? { selected_plan: selectedPlan } : {}),
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setServerError(error.message)
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
          style={{ background: 'rgba(34,255,153,0.08)', border: '1px solid rgba(34,255,153,0.2)' }}
        >
          <svg className="h-7 w-7 text-[#22ff99]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="space-y-2">
          <h2
            className="text-[20px] font-normal tracking-[-0.5px] text-white"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            Check your email
          </h2>
          <p className="text-[13px] text-[#a1a4a5] leading-relaxed max-w-[300px] mx-auto">
            We&apos;ve sent a confirmation link. Click it to activate your account and start setting up your hostel.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-block text-[13px] font-semibold text-white transition-colors hover:text-white/80"
        >
          ← Back to sign in
        </Link>
      </div>
    )
  }

  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'gh-hostels.com'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2 text-center">
        <h1
          className="text-[24px] font-normal tracking-[-0.5px] text-white"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          {selectedPlan === 'trial' || !selectedPlan ? 'Start your free trial' : 'Create your account'}
        </h1>
        <p className="text-[14px] text-[#a1a4a5]">
          Set up your hostel in minutes. {selectedPlan === 'trial' || !selectedPlan ? 'No credit card required.' : 'You\u2019ll subscribe after email confirmation.'}
        </p>
        {selectedPlan && (
          <div
            className="mx-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold text-[#3b9eff]"
            style={{ border: '1px solid rgba(59,158,255,0.3)', background: 'rgba(59,158,255,0.08)' }}
          >
            <Sparkles className="h-3 w-3" />
            {PLAN_LABEL[selectedPlan]}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Hostel name */}
        <div className="space-y-1.5">
          <label htmlFor="hostelName" className="text-[13px] font-medium text-[#a1a4a5]">
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
            <p className="text-[12px] text-[#ff2047] mt-1">{errors.hostelName.message}</p>
          )}

          {/* Slug preview */}
          {slugPreview.length >= 2 && (
            <div
              className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[12px]"
              style={{ border: `1px solid ${FROST}`, background: 'rgba(255,255,255,0.02)' }}
            >
              <span className="text-[#464a4d]">Your URL:</span>
              <span className="font-mono text-[#a1a4a5] font-medium">
                {slugPreview}.{appDomain}
              </span>
              {slugStatus === 'checking' && <Loader2 className="ml-auto h-3 w-3 animate-spin text-[#464a4d]" />}
              {slugStatus === 'available' && <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-[#22ff99]" />}
              {slugStatus === 'taken' && (
                <>
                  <XCircle className="ml-auto h-3.5 w-3.5 text-[#ff2047]" />
                  <span className="text-[#ff2047] font-medium">taken</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-[13px] font-medium text-[#a1a4a5]">
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
            <p className="text-[12px] text-[#ff2047] mt-1">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-[13px] font-medium text-[#a1a4a5]">
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
            <p className="text-[12px] text-[#ff2047] mt-1">{errors.password.message}</p>
          )}
        </div>

        {/* Confirm password */}
        <div className="space-y-1.5">
          <label htmlFor="confirmPassword" className="text-[13px] font-medium text-[#a1a4a5]">
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
            <p className="text-[12px] text-[#ff2047] mt-1">{errors.confirmPassword.message}</p>
          )}
        </div>

        {serverError && (
          <div
            className="rounded-xl px-4 py-3 text-[13px] text-[#ff2047]"
            style={{ border: '1px solid rgba(255,32,71,0.2)', background: 'rgba(255,32,71,0.06)' }}
          >
            {serverError}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || slugStatus === 'taken'}
          className="w-full rounded-full bg-white px-4 py-3 text-[14px] font-semibold text-black transition-all hover:bg-white/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          {isSubmitting ? 'Creating account\u2026' : 'Create account'}
        </button>

        <p className="text-center text-[11px] text-[#464a4d]">
          By signing up you agree to our{' '}
          <a href="#" className="text-white hover:text-white/80 underline underline-offset-2">Terms</a>
          {' '}and{' '}
          <a href="#" className="text-white hover:text-white/80 underline underline-offset-2">Privacy Policy</a>.
        </p>
      </form>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full" style={{ borderTop: `1px solid ${FROST}` }} /></div>
        <div className="relative flex justify-center"><span className="bg-black px-3 text-[12px] text-[#464a4d]">or</span></div>
      </div>

      <p className="text-center text-[13px] text-[#a1a4a5]">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-white transition-colors hover:text-white/80">
          Sign in
        </Link>
      </p>
    </div>
  )
}
