import { AlertCircle, Loader2 } from 'lucide-react'

import { BeddiloWordmark } from '@/components/brand/beddilo-logo'

/**
 * Shared presentation for the (auth) pages — login, signup, forgot and
 * reset password — on the white card of app/(auth)/layout.tsx, matching the
 * marketplace: near-black type, teal for actions. Styling only: each page
 * keeps its own form state, schema and API calls.
 *
 * Contrast notes (on white): input borders ink/30 (≥3:1 for non-text UI),
 * helper copy slate, error text bd-danger and success text bd-success, both
 * above 4.5:1.
 */

export const authInputClass =
  'w-full rounded-lg border border-bd-ink/30 bg-white px-3.5 py-3 text-[16px] text-bd-ink sm:text-[15px] ' +
  'placeholder:text-bd-slate/80 transition-colors duration-200 ' +
  'hover:border-bd-ink/50 focus:border-bd-teal focus:outline-none focus:ring-2 focus:ring-bd-teal/20 ' +
  'aria-[invalid=true]:border-bd-danger aria-[invalid=true]:focus:ring-bd-danger/20'

export const authLabelClass = 'block text-[14px] font-semibold text-bd-ink'

export const authLinkClass =
  'bd-focus rounded font-semibold text-bd-teal underline-offset-2 transition-colors hover:text-bd-teal-900 hover:underline'

export const authPrimaryButtonClass =
  'bd-focus inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-bd-teal px-4 text-[15px] font-semibold text-white ' +
  'transition-colors hover:bg-bd-teal-900 disabled:cursor-not-allowed disabled:opacity-60'

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
    <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1.5 text-[13px] text-bd-danger">
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
      ? 'border-bd-danger/25 bg-bd-danger/[0.06] text-bd-danger'
      : 'border-bd-success/25 bg-bd-success/[0.06] text-bd-success'
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-[14px] leading-relaxed ${styles}`}>
      {children}
    </div>
  )
}

export function AuthHeading({ title, subtitle }: { title: string; subtitle?: React.ReactNode }) {
  return (
    <div className="space-y-2 text-center">
      <h1 className="font-display text-[24px] font-bold leading-tight tracking-[-0.015em] text-bd-ink sm:text-[26px]">
        {title}
      </h1>
      {subtitle && <p className="text-[15px] leading-relaxed text-bd-slate">{subtitle}</p>}
    </div>
  )
}

export function AuthDivider() {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className="h-px flex-1 bg-bd-ink/10" />
      <span className="text-[13px] text-bd-slate">or</span>
      <span className="h-px flex-1 bg-bd-ink/10" />
    </div>
  )
}

/** Round icon badge for the confirmation and error states. */
export function AuthStatusIcon({
  tone = 'default',
  children,
}: {
  tone?: 'default' | 'danger'
  children: React.ReactNode
}) {
  const styles = tone === 'danger' ? 'bg-bd-danger/10 text-bd-danger' : 'bg-bd-teal/10 text-bd-teal'
  return (
    <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${styles}`}>
      {children}
    </div>
  )
}

const cardClass =
  'w-full max-w-[440px] rounded-xl border border-bd-ink/10 bg-white p-6 sm:p-8 ' +
  'shadow-[0_1px_2px_rgba(18,36,41,0.04),0_12px_32px_-16px_rgba(18,36,41,0.14)]'

/**
 * Whole page for auth screens outside app/(auth) — invite, set password,
 * verify code, email confirm — which run on tenant hosts before a session
 * exists, so they show the Beddilo wordmark over the same card.
 */
export function AuthPage({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-[100dvh] flex-col items-center justify-center bg-bd-mist px-4 py-12 text-bd-ink"
      style={{ paddingTop: 'max(3rem, env(safe-area-inset-top))', paddingBottom: 'max(3rem, env(safe-area-inset-bottom))' }}
    >
      <BeddiloWordmark className="mb-7 h-8 w-auto text-bd-teal" />
      <div className={cardClass}>{children}</div>
    </div>
  )
}

/** Full-page spinner for the same screens while a session is checked. */
export function AuthLoading({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-bd-mist px-4" role="status">
      <Loader2 className="h-7 w-7 animate-spin text-bd-teal motion-reduce:animate-none" aria-hidden="true" />
      {label
        ? <p className="text-[14px] font-medium text-bd-slate">{label}</p>
        : <span className="sr-only">Loading</span>}
    </div>
  )
}
