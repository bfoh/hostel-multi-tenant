import type { Metadata } from 'next'

import { BeddiloWordmark } from '@/components/brand/beddilo-logo'
import { authLinkClass, authPrimaryButtonClass } from '@/components/auth/auth-ui'

export const metadata: Metadata = { title: 'Confirm your account' }
export const dynamic = 'force-dynamic'

/**
 * Email confirmation landing. The activation email links here (a plain GET,
 * which email scanners may prefetch harmlessly). Verification only happens
 * when the user submits the form below — a POST to /auth/callback — so a
 * prefetch can't burn the single-use token.
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>
}) {
  const { token_hash = '', type = 'signup' } = await searchParams
  const valid = !!token_hash

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-bd-mist px-4 py-12 text-bd-ink">
      <BeddiloWordmark className="mb-7 h-8 w-auto text-bd-teal" />
      <div className="w-full max-w-[440px] rounded-xl border border-bd-ink/10 bg-white p-6 text-center shadow-[0_1px_2px_rgba(18,36,41,0.04),0_12px_32px_-16px_rgba(18,36,41,0.14)] sm:p-8">
        <h1 className="font-display text-[24px] font-bold tracking-[-0.015em] text-bd-ink">
          {valid ? 'Confirm your account' : 'Invalid link'}
        </h1>

        {valid ? (
          <>
            <p className="mt-3 text-[14px] leading-relaxed text-bd-slate">
              Click below to activate your account and continue setting up your property.
            </p>
            <form method="POST" action="/auth/callback" className="mt-6">
              <input type="hidden" name="token_hash" value={token_hash} />
              <input type="hidden" name="type" value={type} />
              <button type="submit" className={authPrimaryButtonClass}>
                Confirm my account
              </button>
            </form>
          </>
        ) : (
          <p className="mt-3 text-[14px] leading-relaxed text-bd-slate">
            This confirmation link is missing its token. Request a new one from the
            login page using “Resend confirmation email”.
          </p>
        )}

        <a href="/login" className={`${authLinkClass} mt-6 inline-block text-[14px]`}>
          ← Back to sign in
        </a>
      </div>
    </div>
  )
}
