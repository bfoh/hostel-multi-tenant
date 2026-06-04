import { NextResponse } from 'next/server'

// Drops the stray on_auth_user_created trigger that causes
// "Database error saving new user" during signup. Safe to run
// multiple times — IF EXISTS makes it a no-op when already removed.
const FIX_SQL = `
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
`.trim()

export async function POST() {
  const managementToken = process.env.SUPABASE_MANAGEMENT_API_TOKEN
  const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  // Extract project ref: https://abcxyz.supabase.co → abcxyz
  const projectRef      = supabaseUrl.replace(/^https?:\/\//, '').split('.')[0]

  if (!projectRef || projectRef.includes('localhost') || projectRef.includes('127.0.0.1')) {
    return NextResponse.json({
      error:   'Local project — run `supabase db push` from your terminal instead.',
      fix_sql: FIX_SQL,
    }, { status: 400 })
  }

  if (!managementToken) {
    return NextResponse.json({
      error:   'SUPABASE_MANAGEMENT_API_TOKEN is not set. Add it to your environment variables and redeploy, then POST to this endpoint again.',
      how_to_get_token: 'https://supabase.com/dashboard/account/tokens',
      alternative:      'Or go to Supabase dashboard → SQL Editor and run the SQL below manually.',
      fix_sql: FIX_SQL,
    }, { status: 503 })
  }

  let res: Response
  try {
    res = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${managementToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: FIX_SQL }),
      }
    )
  } catch (err) {
    return NextResponse.json({
      error:   'Could not reach Supabase Management API',
      detail:  err instanceof Error ? err.message : String(err),
      fix_sql: FIX_SQL,
    }, { status: 502 })
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return NextResponse.json({
      error:   `Management API responded with ${res.status}`,
      detail:  body,
      fix_sql: FIX_SQL,
    }, { status: 502 })
  }

  return NextResponse.json({
    ok:      true,
    message: 'Stray auth trigger removed. Signup should now work — try creating an account again.',
  })
}
