'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/client'

const FROST = 'rgba(214,235,253,0.19)'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type FormValues = z.infer<typeof schema>

const inputClass =
  `w-full rounded-xl border bg-white/[0.04] px-4 py-3 text-[14px] text-[#f0f0f0] placeholder:text-[#464a4d] transition-all duration-200 focus:outline-none focus:border-[#3b9eff]/50`
const inputBorder = { borderColor: FROST }

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
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2 text-center">
        <h1
          className="text-[24px] font-normal tracking-[-0.5px] text-white"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          Welcome back
        </h1>
        <p className="text-[14px] text-[#a1a4a5]">Sign in to your hostel dashboard</p>
      </div>

      {resetSuccess && (
        <div
          className="rounded-xl px-4 py-3 text-[13px] text-[#22ff99]"
          style={{ border: '1px solid rgba(34,255,153,0.2)', background: 'rgba(34,255,153,0.06)' }}
        >
          Password updated successfully. Sign in with your new password.
        </div>
      )}

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

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-[13px] font-medium text-[#a1a4a5]">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-[12px] font-medium text-white transition-colors hover:text-white/70"
            >
              Forgot your password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register('password')}
            className={inputClass}
            style={inputBorder}
            placeholder="••••••••"
          />
          {errors.password && (
            <p className="text-[12px] text-[#ff2047] mt-1">{errors.password.message}</p>
          )}
        </div>

        {serverError && (
          <div
            className="rounded-xl px-4 py-3 text-[13px] text-[#ff2047] space-y-1.5"
            style={{ border: '1px solid rgba(255,32,71,0.2)', background: 'rgba(255,32,71,0.06)' }}
          >
            <p>{serverError}</p>
            {emailNotConfirmed && (
              <button
                type="button"
                onClick={resendConfirmation}
                disabled={resendState !== 'idle'}
                className="text-[12px] font-semibold underline underline-offset-2 disabled:opacity-60"
              >
                {resendState === 'sending' ? 'Sending\u2026' : resendState === 'sent' ? 'Sent. Check your inbox.' : 'Resend confirmation email'}
              </button>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full bg-white px-4 py-3 text-[14px] font-semibold text-black transition-all hover:bg-white/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          {isSubmitting ? 'Signing in\u2026' : 'Log In'}
        </button>
      </form>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full" style={{ borderTop: `1px solid ${FROST}` }} /></div>
        <div className="relative flex justify-center"><span className="bg-black px-3 text-[12px] text-[#464a4d]">or</span></div>
      </div>

      <p className="text-center text-[13px] text-[#a1a4a5]">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="font-semibold text-white transition-colors hover:text-white/80">
          Sign up
        </Link>
      </p>

      {/* Resident hint */}
      <div
        className="rounded-xl px-4 py-4 space-y-1.5"
        style={{ border: `1px solid ${FROST}`, background: 'rgba(255,255,255,0.02)' }}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-md" style={{ background: 'rgba(59,158,255,0.15)' }}>
            <svg className="h-3 w-3 text-[#3b9eff]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
              <path d="M6 12v5c0 1.1 2.7 2 6 2s6-.9 6-2v-5"/>
            </svg>
          </div>
          <p className="text-[13px] font-medium text-white">Student or resident?</p>
        </div>
        <p className="text-[12px] text-[#464a4d] leading-relaxed pl-7">
          Use this same page to sign in. Your credentials were sent by your hostel management &mdash; you&apos;ll be taken to your portal automatically.
        </p>
      </div>
    </div>
  )
}
