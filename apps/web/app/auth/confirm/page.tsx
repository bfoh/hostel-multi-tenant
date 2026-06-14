import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Confirm your account — GH-HOSTELS' }
export const dynamic = 'force-dynamic'

const INK = '#0A0A08'
const IVORY = '#F5E9D2'
const GOLD = '#D4A24C'
const GOLD_SOFT = '#F5C26B'
const GOLD_DEEP = '#B8842E'
const FOREST_DEEP = '#0A3729'
const HAIR_STRONG = 'rgba(245, 233, 210, 0.18)'

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
    <div
      className="flex min-h-[100dvh] items-center justify-center px-4 py-12"
      style={{ background: INK, color: IVORY }}
    >
      <div
        className="w-full max-w-[420px] rounded-2xl p-8 text-center"
        style={{
          border: `1px solid ${HAIR_STRONG}`,
          background: 'linear-gradient(180deg, rgba(245,233,210,0.03) 0%, rgba(245,233,210,0.005) 100%)',
        }}
      >
        <h1
          className="text-[22px] font-normal tracking-[-0.5px]"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif', color: IVORY }}
        >
          {valid ? 'Confirm your account' : 'Invalid link'}
        </h1>

        {valid ? (
          <>
            <p className="mt-3 text-[14px]" style={{ color: 'rgba(245,233,210,0.6)' }}>
              Click below to activate your account and continue setting up your hostel.
            </p>
            <form method="POST" action="/auth/callback" className="mt-6">
              <input type="hidden" name="token_hash" value={token_hash} />
              <input type="hidden" name="type" value={type} />
              <button
                type="submit"
                className="block w-full rounded-full py-3.5 text-[14px] font-semibold"
                style={{
                  background: `linear-gradient(135deg, ${GOLD_SOFT} 0%, ${GOLD} 50%, ${GOLD_DEEP} 100%)`,
                  color: FOREST_DEEP,
                  boxShadow: '0 10px 28px -10px rgba(212,162,76,0.55)',
                }}
              >
                Confirm my account
              </button>
            </form>
          </>
        ) : (
          <p className="mt-3 text-[14px]" style={{ color: 'rgba(245,233,210,0.6)' }}>
            This confirmation link is missing its token. Request a new one from the
            login page using “Resend confirmation email”.
          </p>
        )}

        <a
          href="https://gh-hostels.com/login"
          className="mt-6 inline-block text-[13px] font-semibold transition-colors hover:opacity-80"
          style={{ color: GOLD }}
        >
          ← Back to sign in
        </a>
      </div>
    </div>
  )
}
