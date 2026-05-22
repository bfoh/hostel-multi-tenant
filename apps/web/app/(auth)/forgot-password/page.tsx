'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const FROST = 'rgba(214,235,253,0.19)'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
})

type FormValues = z.infer<typeof schema>

const inputClass =
  `w-full rounded-xl border bg-white/[0.04] px-4 py-3 text-[14px] text-[#f0f0f0] placeholder:text-[#464a4d] transition-all duration-200 focus:outline-none focus:border-[#3b9eff]/50`
const inputBorder = { borderColor: FROST }

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
          style={{ background: 'rgba(59,158,255,0.08)', border: '1px solid rgba(59,158,255,0.2)' }}
        >
          <svg className="h-7 w-7 text-[#3b9eff]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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
            If an account exists, we&apos;ve emailed a reset code. Enter it on the
            reset page to choose a new password. The code expires in 1 hour.
          </p>
        </div>
        <Link
          href="/reset-password"
          className="inline-block w-full rounded-full bg-white px-4 py-3 text-[14px] font-semibold text-black transition-all hover:bg-white/90"
        >
          Enter reset code
        </Link>
        <Link
          href="/login"
          className="inline-block text-[13px] font-semibold text-white transition-colors hover:text-white/80"
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
          className="text-[24px] font-normal tracking-[-0.5px] text-white"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          Reset your password
        </h1>
        <p className="text-[14px] text-[#a1a4a5]">
          Enter your email and we&apos;ll send you a reset link.
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
            autoFocus
            {...register('email')}
            className={inputClass}
            style={inputBorder}
            placeholder="kwame@example.com"
          />
          {errors.email && (
            <p className="text-[12px] text-[#ff2047] mt-1">{errors.email.message}</p>
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
          {isSubmitting ? 'Sending\u2026' : 'Send reset link'}
        </button>
      </form>

      <p className="text-center text-[13px] text-[#a1a4a5]">
        Remembered it?{' '}
        <Link href="/login" className="font-semibold text-white transition-colors hover:text-white/80">
          Back to sign in
        </Link>
      </p>
    </div>
  )
}
