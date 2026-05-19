/**
 * Paystack hosted-page callback for damage deposit pay links.
 *
 * Verifies the transaction with Paystack and redirects the guest back to
 * the hostel's public booking page with a pay status flag. The actual
 * damage_deposits row is written by the unified Paystack webhook.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { verifyTransaction } from '@/lib/paystack'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const reference = searchParams.get('reference') ?? searchParams.get('trxref')
  const slug      = searchParams.get('slug') ?? ''

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get('host')}`
  const target = (status: 'success' | 'failed' | 'error') =>
    new URL(`/book/${slug}?pay=${status}&kind=deposit`, appUrl)

  if (!reference || !slug) {
    return NextResponse.redirect(target('error'))
  }

  try {
    const data = await verifyTransaction(reference)
    if (data.status === 'success') {
      return NextResponse.redirect(target('success'))
    }
    return NextResponse.redirect(target('failed'))
  } catch (err) {
    console.error('[deposit pay-link callback] verify failed', err)
    return NextResponse.redirect(target('error'))
  }
}
