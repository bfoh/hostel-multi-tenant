'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle2, XCircle, Loader2, Sparkles } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'

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
  'w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand hover:border-slate-300'

function toSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
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

  if (success) {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 ring-4 ring-emerald-50/50">
          <svg className="h-7 w-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="space-y-1.5">
          <h2 className="font-display text-xl font-bold text-slate-900">Check your email</h2>
          <p className="text-sm text-slate-500 leading-relaxed max-w-[300px] mx-auto">
            We&apos;ve sent a confirmation link to your email address. Click it to activate your account.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-block text-sm font-semibold text-brand hover:text-brand-hover transition-colors"
        >
          Back to sign in
        </Link>
      </div>
    )
  }

  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'gh-hostels.com'

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <h1 className="font-display text-[26px] font-bold text-slate-900 tracking-tight">
          {selectedPlan === 'trial' || !selectedPlan ? 'Start your free trial' : 'Create your account'}
        </h1>
        <p className="text-[14px] text-slate-500">
          Set up your hostel in minutes. {selectedPlan === 'trial' || !selectedPlan ? 'No credit card required.' : 'You\u2019ll subscribe after email confirmation.'}
        </p>
        {selectedPlan && (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
            <Sparkles className="h-3 w-3" />
            {PLAN_LABEL[selectedPlan]}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div className="space-y-1.5">
          <label htmlFor="hostelName" className="text-[13px] font-semibold text-slate-700">
            Hostel name
          </label>
          <input
            id="hostelName"
            type="text"
            autoComplete="organization"
            autoFocus
            {...register('hostelName')}
            className={inputClass}
            placeholder="Acacia Hostel"
          />
          {errors.hostelName && (
            <p className="text-xs text-danger font-medium mt-1">{errors.hostelName.message}</p>
          )}

          {slugPreview.length >= 2 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs">
              <span className="text-slate-500">Your URL:</span>
              <span className="font-mono text-slate-800 font-medium">
                {slugPreview}.{appDomain}
              </span>
              {slugStatus === 'checking' && <Loader2 className="ml-auto h-3 w-3 animate-spin text-slate-400" />}
              {slugStatus === 'available' && <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-emerald-500" />}
              {slugStatus === 'taken' && (
                <>
                  <XCircle className="ml-auto h-3.5 w-3.5 text-red-500" />
                  <span className="text-red-600 font-medium">taken</span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-[13px] font-semibold text-slate-700">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            {...register('email')}
            className={inputClass}
            placeholder="kwame@acaciahostel.com"
          />
          {errors.email && (
            <p className="text-xs text-danger font-medium mt-1">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-[13px] font-semibold text-slate-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            {...register('password')}
            className={inputClass}
            placeholder="Min. 8 characters, one uppercase, one number"
          />
          {errors.password && (
            <p className="text-xs text-danger font-medium mt-1">{errors.password.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirmPassword" className="text-[13px] font-semibold text-slate-700">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            {...register('confirmPassword')}
            className={inputClass}
            placeholder="••••••••"
          />
          {errors.confirmPassword && (
            <p className="text-xs text-danger font-medium mt-1">{errors.confirmPassword.message}</p>
          )}
        </div>

        {serverError && (
          <div className="rounded-lg bg-red-50 border border-red-200/60 px-4 py-3 text-sm text-red-700">
            {serverError}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || slugStatus === 'taken'}
          className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-fg shadow-sm transition-all duration-200 hover:bg-brand-hover hover:shadow-md active:scale-[0.98] active:shadow-none focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          {isSubmitting ? 'Creating account\u2026' : 'Create account'}
        </button>

        <p className="text-center text-xs text-slate-400">
          By signing up you agree to our{' '}
          <a href="#" className="text-brand hover:text-brand-hover underline underline-offset-2">Terms of Service</a>
          {' '}and{' '}
          <a href="#" className="text-brand hover:text-brand-hover underline underline-offset-2">Privacy Policy</a>.
        </p>
      </form>

      <p className="text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-brand hover:text-brand-hover transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  )
}
