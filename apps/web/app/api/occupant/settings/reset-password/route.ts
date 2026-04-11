import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/occupant/settings/reset-password
// Sends a Supabase password-reset email to the authenticated user's email.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = user.email
  if (!email) return NextResponse.json({ error: 'No email on account' }, { status: 400 })

  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? `https://${process.env.NEXT_PUBLIC_APP_DOMAIN ? `app.${process.env.NEXT_PUBLIC_APP_DOMAIN}` : 'localhost:3000'}`
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/callback?type=recovery`,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
