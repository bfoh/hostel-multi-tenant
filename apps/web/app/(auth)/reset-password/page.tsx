'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/client'
import { PasswordInput } from '@/components/ui/password-input'

const FROST = 'rgba(214,235,253,0.19)'

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

const inputClass =
  `w-full rounded-xl border bg-white/[0.04] px-4 py-3 text-[14px] text-[#f0f0f0] placeholder:text-[#464a4d] transition-all duration-200 focus:outline-none focus:border-[#3b9eff]/50`
const inputBorder = { borderColor: FROST }

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

    // 3. Sign out other sessions, then send them to login.
    await supabase.auth.signOut({ scope: 'others' })
    router.push('/login?reset=success')
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1
          className="text-[24px] font-normal tracking-[-0.5px] text-white"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          Set new password
        </h1>
        <p className="text-[14px] text-[#a1a4a5]">
          Enter the code from your email, then choose a new password.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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
            placeholder="kwame@example.com"
          />
          {errors.email && (
            <p className="text-[12px] text-[#ff2047] mt-1">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="code" className="text-[13px] font-medium text-[#a1a4a5]">
            Reset code
          </label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={10}
            {...register('code')}
            className={`${inputClass} tracking-[4px] text-center font-mono`}
            style={inputBorder}
            placeholder="Code from email"
          />
          {errors.code && (
            <p className="text-[12px] text-[#ff2047] mt-1">{errors.code.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-[13px] font-medium text-[#a1a4a5]">
            New password
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

        <div className="space-y-1.5">
          <label htmlFor="confirmPassword" className="text-[13px] font-medium text-[#a1a4a5]">
            Confirm new password
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
          disabled={isSubmitting}
          className="w-full rounded-full bg-white px-4 py-3 text-[14px] font-semibold text-black transition-all hover:bg-white/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          {isSubmitting ? 'Updating password…' : 'Update password'}
        </button>
      </form>

      <p className="text-center text-[13px] text-[#a1a4a5]">
        Didn&apos;t get a code?{' '}
        <Link href="/forgot-password" className="font-semibold text-white transition-colors hover:text-white/80">
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
