import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createSb } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/debug-confirm — temporary. Runs the real confirm path end to end on
 * a throwaway user: generateLink('signup') → verifyOtp({token_hash,type:signup})
 * → reports whether email_confirmed_at got set. Delete after.
 */
export async function GET(req: NextRequest) {
  const admin  = createAdminClient()
  const host   = req.headers.get('host') ?? ''
  const proto  = host.includes('localhost') ? 'http' : 'https'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`

  const email = `debug-confirm-${Date.now()}@gh-hostels.com`
  const { data: gen, error: genErr } = await admin.auth.admin.generateLink({
    type:     'signup',
    email,
    password: `Dbg-${Date.now()}-Aa1!`,
    options:  { redirectTo: `${appUrl}/auth/callback` },
  })
  if (genErr || !gen?.properties?.hashed_token) {
    return NextResponse.json({ step: 'generateLink', error: genErr?.message ?? 'no hashed_token' })
  }

  const userId    = gen.user?.id
  const tokenHash = gen.properties.hashed_token
  const vtype     = gen.properties.verification_type

  // Verify via a plain anon client (mirrors what the callback does).
  const sb = createSb(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { error: vErr } = await sb.auth.verifyOtp({
    token_hash: tokenHash,
    type:       (vtype ?? 'signup') as 'signup' | 'magiclink',
  })

  // Read confirmation status back.
  let confirmedAfter: string | null | undefined = undefined
  if (userId) {
    const { data: u } = await admin.auth.admin.getUserById(userId)
    confirmedAfter = u?.user?.email_confirmed_at ?? null
    await admin.auth.admin.deleteUser(userId).catch(() => {})
  }

  return NextResponse.json({
    verification_type_used: vtype,
    verifyOtp_error:        vErr?.message ?? null,
    email_confirmed_at:     confirmedAfter ?? null,
    confirmed:              !!confirmedAfter,
  })
}
