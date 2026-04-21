'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/client'

const FROST = 'rgba(214,235,253,0.19)'

const schema = z
  .object({
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

export default function ResetPasswordPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    setServerError(null)
    const supabase = createClient()

    const { error } = await supabase.auth.updateUser({
      password: values.password,
    })

    if (error) {
      setServerError(error.message)
      return
    }

    // Sign out all other sessions after password change
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
          Choose a strong password for your account.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-[13px] font-medium text-[#a1a4a5]">
            New password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            autoFocus
            {...register('password')}
            className={inputClass}
            style={inputBorder}
            placeholder="Min. 8 characters, one uppercase, one number"
          />
          {errors.password && (
            <p className="text-[12px] text-[#ff2047] mt-1">{errors.password.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirmPassword" className="text-[13px] font-medium text-[#a1a4a5]">
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            {...register('confirmPassword')}
            className={inputClass}
            style={inputBorder}
            placeholder="••••••••"
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
          {isSubmitting ? 'Updating password\u2026' : 'Update password'}
        </button>
      </form>

      <p className="text-center text-[13px] text-[#a1a4a5]">
        <Link href="/login" className="font-semibold text-white transition-colors hover:text-white/80">
          ← Back to sign in
        </Link>
      </p>
    </div>
  )
}
