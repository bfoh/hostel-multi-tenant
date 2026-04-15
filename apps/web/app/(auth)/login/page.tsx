'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/client'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type FormValues = z.infer<typeof schema>

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand hover:border-slate-300'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/dashboard'
  const resetSuccess = searchParams.get('reset') === 'success'

  const [serverError, setServerError] = useState<string | null>(null)
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false)
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    setServerError(null)
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    })

    if (error) {
      const isUnconfirmed = error.message === 'Email not confirmed' || error.code === 'email_not_confirmed'
      if (isUnconfirmed) {
        setEmailNotConfirmed(true)
        setServerError('Your email address has not been confirmed yet. Check your inbox and click the confirmation link.')
      } else {
        setEmailNotConfirmed(false)
        setServerError(
          error.message === 'Invalid login credentials' || error.code === 'invalid_credentials'
            ? 'Incorrect email or password.'
            : error.message
        )
      }
      return
    }

    router.push(next)
    router.refresh()
  }

  async function resendConfirmation() {
    const email = (document.getElementById('email') as HTMLInputElement)?.value
    if (!email) return
    setResendState('sending')
    const supabase = createClient()
    await supabase.auth.resend({ type: 'signup', email })
    setResendState('sent')
  }

  return (
    <div className="space-y-7">
      <div className="space-y-1.5">
        <h1 className="font-display text-[26px] font-bold text-slate-900 tracking-tight">Welcome back</h1>
        <p className="text-[14px] text-slate-500">Sign in to your hostel dashboard</p>
      </div>

      {resetSuccess && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200/60 px-4 py-3 text-sm text-emerald-700 font-medium">
          Password updated successfully. Sign in with your new password.
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-[13px] font-semibold text-slate-700">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            {...register('email')}
            className={inputClass}
            placeholder="kwame@example.com"
          />
          {errors.email && (
            <p className="text-xs text-danger font-medium mt-1">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-[13px] font-semibold text-slate-700">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-brand hover:text-brand-hover transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register('password')}
            className={inputClass}
            placeholder="••••••••"
          />
          {errors.password && (
            <p className="text-xs text-danger font-medium mt-1">{errors.password.message}</p>
          )}
        </div>

        {serverError && (
          <div className="rounded-lg bg-red-50 border border-red-200/60 px-4 py-3 text-sm text-red-700 space-y-1.5">
            <p>{serverError}</p>
            {emailNotConfirmed && (
              <button
                type="button"
                onClick={resendConfirmation}
                disabled={resendState !== 'idle'}
                className="text-xs font-semibold underline underline-offset-2 disabled:opacity-60"
              >
                {resendState === 'sending' ? 'Sending\u2026' : resendState === 'sent' ? 'Sent. Check your inbox.' : 'Resend confirmation email'}
              </button>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-fg shadow-sm transition-all duration-200 hover:bg-brand-hover hover:shadow-md active:scale-[0.98] active:shadow-none focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          {isSubmitting ? 'Signing in\u2026' : 'Sign in'}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100" /></div>
        <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-slate-400">or</span></div>
      </div>

      <p className="text-center text-sm text-slate-500">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="font-semibold text-brand hover:text-brand-hover transition-colors">
          Start free trial
        </Link>
      </p>

      {/* ── Resident / student hint ───────────────────────────── */}
      <div className="rounded-xl border border-slate-200/80 bg-slate-50 px-4 py-4 space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-brand/10">
            <svg className="h-3 w-3 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
              <path d="M6 12v5c0 1.1 2.7 2 6 2s6-.9 6-2v-5"/>
            </svg>
          </div>
          <p className="text-[13px] font-semibold text-slate-700">Student or resident?</p>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed pl-7">
          Use this same page to access your resident portal. Your login credentials were sent by your hostel management &mdash; sign in and you&apos;ll be taken to your portal automatically.
        </p>
      </div>
    </div>
  )
}
