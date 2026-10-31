'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { GraduationCap, Loader2, ChevronDown } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { PasswordInput } from '@/components/ui/password-input'
import {
  AuthAlert,
  AuthDivider,
  AuthHeading,
  FieldError,
  authInputClass,
  authLabelClass,
  authLinkClass,
  authPrimaryButtonClass,
  fieldA11y,
} from '@/components/auth/auth-ui'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/dashboard'
  const resetSuccess = searchParams.get('reset') === 'success'

  // If Supabase bounced an expired/invalid auth link to the login page, forward
  // the hash to /auth/invite which already renders a friendly "invite expired"
  // screen instead of leaving the user staring at a regular login form with
  // a confusing URL fragment.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash
    if (!hash || hash.length < 2) return
    const params = new URLSearchParams(hash.slice(1))
    if (params.has('error') || params.has('error_code')) {
      window.location.replace(`/auth/invite${hash}`)
    }
  }, [])

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

    const { data, error } = await supabase.auth.signInWithPassword({
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

    if (data.user?.user_metadata?.must_change_password) {
      router.push(`/auth/set-password?next=${encodeURIComponent(next)}`)
    } else {
      router.push(next)
    }
    router.refresh()
  }

  async function resendConfirmation() {
    const email = (document.getElementById('email') as HTMLInputElement)?.value
    if (!email) return
    setResendState('sending')
    // Send via our Brevo-backed route (Supabase's built-in SMTP is unused).
    await fetch('/api/auth/resend-confirmation', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email }),
    }).catch(() => {})
    setResendState('sent')
  }

  return (
    <div className="space-y-5">
      <AuthHeading title="Welcome back" subtitle="Sign in to your dashboard or resident portal." />

      {resetSuccess && (
        <AuthAlert tone="success">Password updated successfully. Sign in with your new password.</AuthAlert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className={`${authLabelClass} mb-1.5`}>
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            {...register('email')}
            {...fieldA11y('email', !!errors.email)}
            className={authInputClass}
            placeholder="you@example.com"
          />
          <FieldError id="email" message={errors.email?.message} />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <label htmlFor="password" className={authLabelClass}>
              Password
            </label>
            <Link href="/forgot-password" className={`${authLinkClass} text-[13px]`}>
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            {...register('password')}
            {...fieldA11y('password', !!errors.password)}
            className={authInputClass}
            placeholder="Your password"
           
          />
          <FieldError id="password" message={errors.password?.message} />
        </div>

        {serverError && (
          <AuthAlert>
            <p>{serverError}</p>
            {emailNotConfirmed && (
              <button
                type="button"
                onClick={resendConfirmation}
                disabled={resendState !== 'idle'}
                className="bd-focus mt-1.5 rounded text-[13px] font-semibold underline underline-offset-2 disabled:opacity-70"
              >
                {resendState === 'sending'
                  ? 'Sending…'
                  : resendState === 'sent'
                  ? 'Sent. Check your inbox.'
                  : 'Resend confirmation email'}
              </button>
            )}
          </AuthAlert>
        )}

        <button type="submit" disabled={isSubmitting} className={authPrimaryButtonClass}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {isSubmitting ? 'Signing in…' : 'Log in'}
        </button>
      </form>

      <AuthDivider />

      <p className="text-center text-[14px] text-bd-slate">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className={authLinkClass}>
          Sign up
        </Link>
      </p>

      {/* Resident hint — one line until opened, so the form stays the focus. */}
      <details className="group rounded-lg border border-bd-ink/10 bg-bd-mist">
        <summary className="bd-focus flex min-h-[48px] cursor-pointer list-none items-center gap-2.5 rounded-lg px-4 py-2.5 [&::-webkit-details-marker]:hidden">
          <GraduationCap className="h-5 w-5 shrink-0 text-bd-teal" strokeWidth={1.75} aria-hidden="true" />
          <span className="flex-1 text-[14px] font-semibold text-bd-ink">Student or resident?</span>
          <ChevronDown className="h-4 w-4 text-bd-slate transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
        </summary>
        <p className="px-4 pb-4 pl-[46px] text-[14px] leading-relaxed text-bd-slate">
          Sign in here with the details your property manager sent you &mdash;
          you&apos;ll be taken to your portal automatically.
        </p>
      </details>
    </div>
  )
}
