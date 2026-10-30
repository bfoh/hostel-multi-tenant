import type { Metadata } from 'next'

import { BeddiloWordmark } from '@/components/brand/beddilo-logo'
import { authLinkClass, authPrimaryButtonClass } from '@/components/auth/auth-ui'

export const metadata: Metadata = { title: 'Confirm your account — Beddilo' }
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
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-bd-teal-950 px-4 py-12 text-bd-ivory">
      <BeddiloWordmark className="mb-7 h-9 w-auto text-bd-ivory" />
      <div className="w-full max-w-[440px] rounded-3xl border border-bd-ivory/15 bg-bd-teal/70 p-6 text-center shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] sm:p-8">
        <h1 className="font-display text-[24px] font-bold tracking-[-0.02em] text-bd-ivory">
          {valid ? 'Confirm your account' : 'Invalid link'}
        </h1>

        {valid ? (
          <>
            <p className="mt-3 text-[14px] leading-relaxed text-bd-ivory/75">
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
          <p className="mt-3 text-[14px] leading-relaxed text-bd-ivory/75">
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
