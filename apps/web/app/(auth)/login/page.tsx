'use client'

import { useEffect, useState } from 'react'
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
const IVORY_DIM = 'rgba(245,233,210,0.4)'
const GOLD = '#D4A24C'
const GOLD_SOFT = '#F5C26B'
const GOLD_DEEP = '#B8842E'
const FOREST_DEEP = '#0A3729'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type FormValues = z.infer<typeof schema>

const inputClass =
  `w-full rounded-xl border bg-[rgba(245,233,210,0.03)] px-4 py-3 text-[14px] text-[#F5E9D2] placeholder:text-[rgba(245,233,210,0.35)] transition-all duration-200 focus:outline-none focus:border-[#D4A24C]/60 focus:bg-[rgba(212,162,76,0.05)]`
const inputBorder = { borderColor: HAIR }

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
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2 text-center">
        <h1
          className="text-[26px] font-normal tracking-[-0.5px]"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif', color: IVORY }}
        >
          Welcome back
        </h1>
        <p className="text-[14px]" style={{ color: IVORY_MUTED }}>
          Sign in to your hostel dashboard
        </p>
      </div>

      {resetSuccess && (
        <div
          className="rounded-xl px-4 py-3 text-[13px]"
          style={{ border: `1px solid ${GOLD}40`, background: `${GOLD}14`, color: GOLD_SOFT }}
        >
          Password updated successfully. Sign in with your new password.
        </div>
      )}

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

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-[13px] font-medium" style={{ color: IVORY_MUTED }}>
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-[12px] font-medium transition-colors hover:opacity-80"
              style={{ color: GOLD }}
            >
              Forgot your password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            {...register('password')}
            className={inputClass}
            style={inputBorder}
            placeholder="••••••••"
            tone="dark"
          />
          {errors.password && (
            <p className="mt-1 text-[12px] text-[#ff6b6b]">{errors.password.message}</p>
          )}
        </div>

        {serverError && (
          <div
            className="space-y-1.5 rounded-xl px-4 py-3 text-[13px] text-[#ff8a8a]"
            style={{ border: '1px solid rgba(255,107,107,0.3)', background: 'rgba(255,107,107,0.08)' }}
          >
            <p>{serverError}</p>
            {emailNotConfirmed && (
              <button
                type="button"
                onClick={resendConfirmation}
                disabled={resendState !== 'idle'}
                className="text-[12px] font-semibold underline underline-offset-2 disabled:opacity-60"
              >
                {resendState === 'sending'
                  ? 'Sending…'
                  : resendState === 'sent'
                  ? 'Sent. Check your inbox.'
                  : 'Resend confirmation email'}
              </button>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full px-4 py-3 text-[14px] font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          style={{
            background: `linear-gradient(135deg, ${GOLD_SOFT} 0%, ${GOLD} 50%, ${GOLD_DEEP} 100%)`,
            color: FOREST_DEEP,
            boxShadow: '0 10px 28px -10px rgba(212,162,76,0.55)',
          }}
        >
          {isSubmitting ? 'Signing in…' : 'Log In'}
        </button>
      </form>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full" style={{ borderTop: `1px solid ${HAIR}` }} />
        </div>
        <div className="relative flex justify-center">
          <span className="px-3 text-[12px]" style={{ background: '#0A0A08', color: IVORY_DIM }}>
            or
          </span>
        </div>
      </div>

      <p className="text-center text-[13px]" style={{ color: IVORY_MUTED }}>
        Don&apos;t have an account?{' '}
        <Link
          href="/signup"
          className="font-semibold transition-colors hover:opacity-80"
          style={{ color: GOLD }}
        >
          Sign up
        </Link>
      </p>

      {/* Resident hint */}
      <div
        className="space-y-1.5 rounded-xl px-4 py-4"
        style={{ border: `1px solid ${HAIR}`, background: 'rgba(245,233,210,0.02)' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="flex h-5 w-5 items-center justify-center rounded-md"
            style={{ background: `${GOLD}22`, border: `1px solid ${GOLD}33` }}
          >
            <svg
              className="h-3 w-3"
              style={{ color: GOLD }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c0 1.1 2.7 2 6 2s6-.9 6-2v-5" />
            </svg>
          </div>
          <p className="text-[13px] font-medium" style={{ color: IVORY }}>
            Student or resident?
          </p>
        </div>
        <p className="pl-7 text-[12px] leading-relaxed" style={{ color: IVORY_DIM }}>
          Use this same page to sign in. Your credentials were sent by your hostel management &mdash;
          you&apos;ll be taken to your portal automatically.
        </p>
      </div>
    </div>
  )
}
