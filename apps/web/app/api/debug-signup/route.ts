import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'

/**
 * GET /api/debug-signup?email=<allowlisted>
 *
 * Temporary diagnostic: reports whether the email already has an auth user,
 * its confirmation status, and whether a magic-link generateLink succeeds —
 * pinpointing why the signup email isn't being generated. Allowlisted to
 * avoid abuse. DELETE once signup email is confirmed working.
 */
const ALLOWED = ['bfohzg@yahoo.com', 'bfoh2g@gmail.com']

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const email = (searchParams.get('email') ?? ALLOWED[0]).trim().toLowerCase()
  if (!ALLOWED.includes(email)) {
    return NextResponse.json({ error: `email not allowed; use ${ALLOWED.join(', ')}` }, { status: 400 })
  }

  const admin = createAdminClient()

  // Find the user by scanning admin list (small user base).
  let found: { id: string; confirmed: boolean; created_at?: string } | null = null
  try {
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    const u = data?.users?.find((x) => x.email?.toLowerCase() === email)
    if (u) found = { id: u.id, confirmed: !!u.email_confirmed_at, created_at: u.created_at }
  } catch (e) {
    return NextResponse.json({ step: 'listUsers', error: e instanceof Error ? e.message : String(e) })
  }

  const host   = req.headers.get('host') ?? ''
  const proto  = host.includes('localhost') ? 'http' : 'https'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`

  // Try magic-link generateLink (the signup fallback path).
  const magic = await admin.auth.admin.generateLink({
    type:    'magiclink',
    email,
    options: { redirectTo: `${appUrl}/auth/callback` },
  })

  // Replicate the real signup path: generateLink('signup') on a throwaway
  // email, then actually send via Brevo, then delete the throwaway user.
  const throwaway = `debug-signup-${Date.now()}@gh-hostels.com`
  const signup = await admin.auth.admin.generateLink({
    type:     'signup',
    email:    throwaway,
    password: `Dbg-${Date.now()}-Aa1!`,
    options:  { data: { hostel_name: 'Debug Hostel' }, redirectTo: `${appUrl}/auth/callback` },
  })
  const signupLink = signup.data?.properties?.action_link

  // Send the resulting confirmation to the allowlisted inbox (not the throwaway).
  let sendResult: { ok: boolean; error?: string } = { ok: false, error: 'no link' }
  if (signupLink) {
    sendResult = await sendEmail({
      to:         email,
      subject:    'GH Hostels — signup-path test',
      senderName: 'GH Hostels',
      html:       `<p>Signup-path test. Link generated OK.</p><p>${signupLink}</p>`,
    })
  }

  // Clean up the throwaway user.
  if (signup.data?.user?.id) {
    await admin.auth.admin.deleteUser(signup.data.user.id).catch(() => {})
  }

  // List any triggers still on auth.users (the "Database error saving new
  // user" culprit is usually one of these throwing).
  const { data: triggers, error: trigErr } = await admin.rpc('pg_get_auth_triggers' as never)

  return NextResponse.json({
    auth_triggers: trigErr ? `lookup failed: ${trigErr.message}` : triggers,
    email,
    user_exists:    !!found,
    confirmed:      found?.confirmed ?? null,
    magiclink_ok:   !!magic.data?.properties?.action_link,
    magiclink_err:  magic.error?.message ?? null,
    signuplink_ok:  !!signupLink,
    signuplink_err: signup.error?.message ?? null,
    send_result:    sendResult,
  })
}
