import { NextResponse, type NextRequest } from 'next/server'
import { verifyTransaction } from '@/lib/paystack'

/**
 * GET /api/billing/callback?reference=...
 *
 * Landing page for the post-subscription-charge redirect. Paystack already
 * creates the subscription and fires subscription.create on the webhook —
 * this handler just verifies the charge succeeded and redirects back to the
 * billing page with a status flag.
 */
export async function GET(req: NextRequest) {
  const reference = req.nextUrl.searchParams.get('reference')
                 ?? req.nextUrl.searchParams.get('trxref')

  const host   = req.headers.get('host') ?? 'localhost:3000'
  const proto  = host.includes('localhost') ? 'http' : 'https'
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`

  if (!reference) {
    return NextResponse.redirect(new URL('/settings/billing?sub=error', origin))
  }

  try {
    const data = await verifyTransaction(reference)
    if (data.status !== 'success') {
      return NextResponse.redirect(new URL('/settings/billing?sub=failed', origin))
    }
    return NextResponse.redirect(new URL('/settings/billing?sub=success', origin))
  } catch {
    return NextResponse.redirect(new URL('/settings/billing?sub=error', origin))
  }
}
