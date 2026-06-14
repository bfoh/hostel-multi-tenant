import { NextResponse, type NextRequest } from 'next/server'
import { sendEmail } from '@/lib/email'

/**
 * GET /api/debug-email?to=you@example.com
 *
 * Temporary, public diagnostic: sends a test email and returns Brevo's actual
 * accept/reject result (which the normal send paths swallow). To avoid abuse,
 * it only sends to an allowlisted address. DELETE this route once email
 * delivery is confirmed working.
 */
const ALLOWED = ['bfohzg@yahoo.com', 'bfoh2g@gmail.com']

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const to = (searchParams.get('to') ?? ALLOWED[0]).trim().toLowerCase()

  if (!ALLOWED.includes(to)) {
    return NextResponse.json(
      { error: `recipient not allowed; use one of ${ALLOWED.join(', ')}` },
      { status: 400 },
    )
  }

  const from = process.env.BREVO_FROM_EMAIL ?? process.env.RESEND_FROM_EMAIL ?? 'no-reply@updates.gh-hostels.com'

  const result = await sendEmail({
    to,
    subject:    'GH Hostels — Brevo test',
    senderName: 'GH Hostels',
    html:       '<p>If you can read this, Brevo delivery works.</p>',
  })

  return NextResponse.json({
    to,
    from,
    brevo_key_present: !!process.env.BREVO_API_KEY,
    result,
  })
}
