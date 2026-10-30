'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { PasswordInput } from '@/components/ui/password-input'
import {
  AuthAlert,
  AuthHeading,
  FieldError,
  authInputClass,
  authLabelClass,
  authLinkClass,
  authPrimaryButtonClass,
  fieldA11y,
} from '@/components/auth/auth-ui'

const schema = z
  .object({
    email: z.string().email('Enter the email you requested the reset for'),
    code:  z.string().trim().regex(/^\d{6,10}$/, 'Enter the numeric code from your email'),
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

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: searchParams.get('email') ?? '',
      code:  searchParams.get('code')  ?? '',
    },
  })

  async function onSubmit(values: FormValues) {
    setServerError(null)
    const supabase = createClient()

    // 1. Exchange the emailed code for a session. 'magiclink' (not
    // 'recovery') — matches the generateLink type the API uses; the
    // recovery pairing intermittently rejects valid codes.
    const { data, error: otpErr } = await supabase.auth.verifyOtp({
      email: values.email.trim().toLowerCase(),
      token: values.code.trim(),
      type:  'magiclink',
    })
    if (otpErr || !data.session) {
      setServerError(otpErr?.message ?? 'Invalid or expired code. Request a new reset email.')
      return
    }

    // 2. Now that we have a session, set the new password.
    const { error: updErr } = await supabase.auth.updateUser({ password: values.password })
    if (updErr) {
      setServerError(updErr.message)
      return
    }

    // 3. Sign out everywhere — including this session — so the user must
    // log in again with the new password instead of being auto-signed-in.
    await supabase.auth.signOut()
    router.push('/login?reset=success')
  }

  return (
    <div className="space-y-6">
      <AuthHeading
        title="Set a new password"
        subtitle="Enter the code from your email, then choose a new password."
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
            {...register('email')}
            {...fieldA11y('email', !!errors.email)}
            className={authInputClass}
            placeholder="you@example.com"
          />
          <FieldError id="email" message={errors.email?.message} />
        </div>

        <div>
          <label htmlFor="code" className={`${authLabelClass} mb-1.5`}>
            Reset code
          </label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={10}
            {...register('code')}
            {...fieldA11y('code', !!errors.code)}
            className={`${authInputClass} text-center font-mono tracking-[4px] placeholder:tracking-normal`}
            placeholder="Code from email"
          />
          <FieldError id="code" message={errors.code?.message} />
        </div>

        <div>
          <label htmlFor="password" className={`${authLabelClass} mb-1.5`}>
            New password
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

        <div>
          <label htmlFor="confirmPassword" className={`${authLabelClass} mb-1.5`}>
            Confirm new password
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

        <button type="submit" disabled={isSubmitting} className={authPrimaryButtonClass}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {isSubmitting ? 'Updating password…' : 'Update password'}
        </button>
      </form>

      <p className="text-center text-[14px] text-bd-ivory/75">
        Didn&apos;t get a code?{' '}
        <Link href="/forgot-password" className={authLinkClass}>
          Request a new one
        </Link>
      </p>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  )
}
