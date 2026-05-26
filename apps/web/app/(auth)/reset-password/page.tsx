'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/client'
import { PasswordInput } from '@/components/ui/password-input'

const HAIR = 'rgba(245,233,210,0.18)'
const IVORY = '#F5E9D2'
const IVORY_MUTED = 'rgba(245,233,210,0.6)'
const GOLD = '#D4A24C'
const GOLD_SOFT = '#F5C26B'
const GOLD_DEEP = '#B8842E'
const FOREST_DEEP = '#0A3729'

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
  `w-full rounded-xl border bg-[rgba(245,233,210,0.03)] px-4 py-3 text-[14px] text-[#F5E9D2] placeholder:text-[rgba(245,233,210,0.35)] transition-all duration-200 focus:outline-none focus:border-[#D4A24C]/60 focus:bg-[rgba(212,162,76,0.05)]`
const inputBorder = { borderColor: HAIR }

const goldButtonStyle = {
  background: `linear-gradient(135deg, ${GOLD_SOFT} 0%, ${GOLD} 50%, ${GOLD_DEEP} 100%)`,
  color: FOREST_DEEP,
  boxShadow: '0 10px 28px -10px rgba(212,162,76,0.55)',
} as const

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
      <div className="space-y-2 text-center">
        <h1
          className="text-[26px] font-normal tracking-[-0.5px]"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif', color: IVORY }}
        >
          Set new password
        </h1>
        <p className="text-[14px]" style={{ color: IVORY_MUTED }}>
          Enter the code from your email, then choose a new password.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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
            placeholder="kwame@example.com"
          />
          {errors.email && (
            <p className="mt-1 text-[12px] text-[#ff6b6b]">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="code" className="text-[13px] font-medium" style={{ color: IVORY_MUTED }}>
            Reset code
          </label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={10}
            {...register('code')}
            className={`${inputClass} text-center font-mono tracking-[4px]`}
            style={inputBorder}
            placeholder="Code from email"
          />
          {errors.code && (
            <p className="mt-1 text-[12px] text-[#ff6b6b]">{errors.code.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-[13px] font-medium" style={{ color: IVORY_MUTED }}>
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
            <p className="mt-1 text-[12px] text-[#ff6b6b]">{errors.password.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirmPassword" className="text-[13px] font-medium" style={{ color: IVORY_MUTED }}>
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
          disabled={isSubmitting}
          className="w-full rounded-full px-4 py-3 text-[14px] font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          style={goldButtonStyle}
        >
          {isSubmitting ? 'Updating password…' : 'Update password'}
        </button>
      </form>

      <p className="text-center text-[13px]" style={{ color: IVORY_MUTED }}>
        Didn&apos;t get a code?{' '}
        <Link
          href="/forgot-password"
          className="font-semibold transition-colors hover:opacity-80"
          style={{ color: GOLD }}
        >
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
