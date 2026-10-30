'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'

import {
  AuthAlert,
  AuthHeading,
  AuthStatusIcon,
  FieldError,
  authInputClass,
  authLabelClass,
  authLinkClass,
  authPrimaryButtonClass,
  fieldA11y,
} from '@/components/auth/auth-ui'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
})

type FormValues = z.infer<typeof schema>

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
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: values.email, host: window.location.host }),
      })
      if (!res.ok) {
        setServerError('Something went wrong. Please try again.')
        return
      }
      setSent(true)
    } catch {
      setServerError('Network error. Please try again.')
    }
  }

  if (sent) {
    return (
      <div className="space-y-5 text-center" role="status">
        <AuthStatusIcon>
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </AuthStatusIcon>
        <AuthHeading
          title="Check your email"
          subtitle={<>If an account exists, we&apos;ve emailed a reset code. Enter it on the reset page to choose a new password. The code expires in 1 hour.</>}
        />
        <Link href="/reset-password" className={authPrimaryButtonClass}>
          Enter reset code
        </Link>
        <Link href="/login" className={`${authLinkClass} inline-block text-[14px]`}>
          ← Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AuthHeading
        title="Reset your password"
        subtitle={<>Enter your email and we&apos;ll send you a reset code.</>}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
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

        {serverError && <AuthAlert>{serverError}</AuthAlert>}

        <button type="submit" disabled={isSubmitting} className={authPrimaryButtonClass}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {isSubmitting ? 'Sending…' : 'Send reset code'}
        </button>
      </form>

      <p className="text-center text-[14px] text-bd-ivory/75">
        Remembered it?{' '}
        <Link href="/login" className={authLinkClass}>
          Back to sign in
        </Link>
      </p>
    </div>
  )
}
