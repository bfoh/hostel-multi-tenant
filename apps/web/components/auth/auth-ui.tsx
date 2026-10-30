import { AlertCircle } from 'lucide-react'

/**
 * Shared presentation for the (auth) pages — login, signup, forgot and
 * reset password — on the Beddilo deep-teal canvas (see app/(auth)/layout.tsx).
 * Styling only: each page keeps its own form state, schema and API calls.
 *
 * Contrast notes (against the teal card): labels are ivory/90, helper copy
 * ivory/75, input borders ivory/40 (≥3:1 for non-text UI), and error text
 * coral-300, which clears 4.5:1 where the brand coral would not.
 */

export const authInputClass =
  'w-full rounded-xl border border-bd-ivory/40 bg-bd-ivory/[0.06] px-4 py-3 text-[16px] text-bd-ivory sm:text-[15px] ' +
  'placeholder:text-bd-ivory/55 transition-colors duration-200 ' +
  'hover:border-bd-ivory/60 focus:border-bd-amber focus:bg-bd-ivory/[0.09] focus:outline-none focus:ring-2 focus:ring-bd-amber/30 ' +
  'aria-[invalid=true]:border-bd-coral-300 aria-[invalid=true]:focus:ring-bd-coral-300/30'

export const authLabelClass = 'block text-[13px] font-semibold text-bd-ivory/90'

export const authLinkClass =
  'bd-focus-on-dark rounded font-semibold text-bd-amber underline-offset-2 transition-colors hover:text-bd-amber-300 hover:underline'

export const authPrimaryButtonClass =
  'bd-focus-on-dark inline-flex w-full items-center justify-center gap-2 rounded-full bg-bd-amber px-4 py-3.5 text-[15px] font-bold text-bd-teal ' +
  'shadow-[0_12px_28px_-14px_rgba(242,185,90,0.8)] transition-all hover:bg-bd-amber-300 active:scale-[0.98] ' +
  'disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 motion-reduce:active:scale-100'

/** aria props linking an input to its <FieldError>. */
export function fieldA11y(id: string, hasError: boolean) {
  return {
    'aria-invalid': hasError || undefined,
    'aria-describedby': hasError ? `${id}-error` : undefined,
  } as const
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1.5 text-[13px] text-bd-coral-300">
      <AlertCircle className="mt-[1px] h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {message}
    </p>
  )
}

export function AuthAlert({
  tone = 'error',
  children,
}: {
  tone?: 'error' | 'success'
  children: React.ReactNode
}) {
  const styles =
    tone === 'error'
      ? 'border-bd-coral-300/40 bg-bd-coral/10 text-bd-coral-300'
      : 'border-bd-amber/40 bg-bd-amber/10 text-bd-amber-300'
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-[14px] leading-relaxed ${styles}`}>
      {children}
    </div>
  )
}

export function AuthHeading({ title, subtitle }: { title: string; subtitle?: React.ReactNode }) {
  return (
    <div className="space-y-2 text-center">
      <h1 className="font-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-bd-ivory sm:text-[28px]">
        {title}
      </h1>
      {subtitle && <p className="text-[14px] leading-relaxed text-bd-ivory/75">{subtitle}</p>}
    </div>
  )
}

export function AuthDivider() {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className="h-px flex-1 bg-bd-ivory/15" />
      <span className="text-[12px] text-bd-ivory/60">or</span>
      <span className="h-px flex-1 bg-bd-ivory/15" />
    </div>
  )
}

/** Round icon badge for the "check your email" confirmation states. */
export function AuthStatusIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-bd-amber/35 bg-bd-amber/10 text-bd-amber">
      {children}
    </div>
  )
}
