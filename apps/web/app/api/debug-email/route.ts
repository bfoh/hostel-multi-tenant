import { NextResponse, type NextRequest } from 'next/server'
import { sendEmail } from '@/lib/email'

/**
 * GET /api/debug-email?secret=<CRON_SECRET>&to=you@example.com
 *
 * Temporary diagnostic: sends a test email and returns Brevo's actual
 * accept/reject result (which the normal send paths swallow). Guarded by
 * CRON_SECRET so it can't be used to spam. Delete once email delivery is
 * confirmed working.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const to = searchParams.get('to')
  if (!to) return NextResponse.json({ error: 'pass ?to=email' }, { status: 400 })

  const from = process.env.BREVO_FROM_EMAIL ?? process.env.RESEND_FROM_EMAIL ?? 'no-reply@updates.gh-hostels.com'

  const result = await sendEmail({
    to,
    subject:    'GH Hostels — Brevo test',
    senderName: 'GH Hostels',
    html:       '<p>If you can read this, Brevo delivery works.</p>',
  })

  return NextResponse.json({
    from,
    brevo_key_present: !!process.env.BREVO_API_KEY,
    result,
  })
}
