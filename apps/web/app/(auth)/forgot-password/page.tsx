'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const HAIR = 'rgba(245,233,210,0.18)'
const IVORY = '#F5E9D2'
const IVORY_MUTED = 'rgba(245,233,210,0.6)'
const GOLD = '#D4A24C'
const GOLD_SOFT = '#F5C26B'
const GOLD_DEEP = '#B8842E'
const FOREST_DEEP = '#0A3729'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
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
      <div className="space-y-5 text-center">
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: `${GOLD}14`, border: `1px solid ${GOLD}40` }}
        >
          <svg className="h-7 w-7" style={{ color: GOLD }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div className="space-y-2">
          <h2
            className="text-[20px] font-normal tracking-[-0.5px]"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif', color: IVORY }}
          >
            Check your email
          </h2>
          <p className="mx-auto max-w-[300px] text-[13px] leading-relaxed" style={{ color: IVORY_MUTED }}>
            If an account exists, we&apos;ve emailed a reset code. Enter it on the
            reset page to choose a new password. The code expires in 1 hour.
          </p>
        </div>
        <Link
          href="/reset-password"
          className="inline-block w-full rounded-full px-4 py-3 text-[14px] font-semibold transition-all active:scale-[0.98]"
          style={goldButtonStyle}
        >
          Enter reset code
        </Link>
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

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1
          className="text-[26px] font-normal tracking-[-0.5px]"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif', color: IVORY }}
        >
          Reset your password
        </h1>
        <p className="text-[14px]" style={{ color: IVORY_MUTED }}>
          Enter your email and we&apos;ll send you a reset link.
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
            autoFocus
            {...register('email')}
            className={inputClass}
            style={inputBorder}
            placeholder="kwame@example.com"
          />
          {errors.email && (
            <p className="mt-1 text-[12px] text-[#ff6b6b]">{errors.email.message}</p>
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
          {isSubmitting ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <p className="text-center text-[13px]" style={{ color: IVORY_MUTED }}>
        Remembered it?{' '}
        <Link href="/login" className="font-semibold transition-colors hover:opacity-80" style={{ color: GOLD }}>
          Back to sign in
        </Link>
      </p>
    </div>
  )
}
