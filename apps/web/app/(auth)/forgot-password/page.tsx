'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/client'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
})

type FormValues = z.infer<typeof schema>

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand hover:border-slate-300'

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    setServerError(null)
    const supabase = createClient()

    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      setServerError(error.message)
      return
    }

    setSent(true)
  }

  if (sent) {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 ring-4 ring-blue-50/50">
          <svg className="h-7 w-7 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div className="space-y-1.5">
          <h2 className="font-display text-xl font-bold text-slate-900">Check your email</h2>
          <p className="text-sm text-slate-500 leading-relaxed max-w-[280px] mx-auto">
            We&apos;ve sent a password reset link to your email. It expires in 1 hour.
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

  return (
    <div className="space-y-7">
      <div className="space-y-1.5">
        <h1 className="font-display text-[26px] font-bold text-slate-900 tracking-tight">Reset your password</h1>
        <p className="text-[14px] text-slate-500">
          Enter your email address and we&apos;ll send you a reset link.
        </p>
      </div>

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

        {serverError && (
          <div className="rounded-lg bg-red-50 border border-red-200/60 px-4 py-3 text-sm text-red-700">
            {serverError}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-fg shadow-sm transition-all duration-200 hover:bg-brand-hover hover:shadow-md active:scale-[0.98] active:shadow-none focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          {isSubmitting ? 'Sending\u2026' : 'Send reset link'}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500">
        Remembered it?{' '}
        <Link href="/login" className="font-semibold text-brand hover:text-brand-hover transition-colors">
          Back to sign in
        </Link>
      </p>
    </div>
  )
}
