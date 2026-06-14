import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'

/**
 * GET /api/debug-email?to=you@example.com
 *
 * Temporary diagnostic: sends a test email and returns Brevo's actual
 * accept/reject result (which the normal send paths swallow). Guarded by
 * platform-admin session — open it in the browser while logged in as a
 * platform admin. Delete once email delivery is confirmed working.
 */
export async function GET(req: NextRequest) {
  // Platform-admin guard (cookie session).
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: isAdmin } = await admin
    .from('platform_admins')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!isAdmin) return NextResponse.json({ error: 'platform admin only' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const to = searchParams.get('to') ?? user.email
  if (!to) return NextResponse.json({ error: 'pass ?to=email' }, { status: 400 })

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
