import { NextResponse, type NextRequest } from 'next/server'
import { verifyTransaction } from '@/lib/paystack'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const reference = searchParams.get('reference') ?? searchParams.get('trxref')
  const slug      = searchParams.get('slug') ?? ''

  // For POS the customer paid on their phone — show a minimal HTML thank-you
  if (!reference) {
    return new NextResponse('Missing reference', { status: 400 })
  }

  try {
    const data = await verifyTransaction(reference)
    const ok = data.status === 'success'
    const title = ok ? 'Payment received' : 'Payment failed'
    const message = ok
      ? 'Thanks! You can return the device to the cashier.'
      : 'Payment was not completed. Please try again or pay with cash.'

    return new NextResponse(
      `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>` +
      `<style>body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f6f7f9}` +
      `.card{max-width:380px;background:#fff;padding:32px;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.06);text-align:center}` +
      `h1{font-size:20px;margin:0 0 8px;color:${ok ? '#15803d' : '#b91c1c'}}p{color:#475569;font-size:14px;margin:0}</style></head>` +
      `<body><div class="card"><h1>${title}</h1><p>${message}</p><p style="margin-top:16px;font-size:11px;color:#94a3b8">${slug || 'POS'} · Paystack ref ${reference}</p></div></body></html>`,
      { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } },
    )
  } catch {
    return new NextResponse('Could not verify payment', { status: 502 })
  }
}
