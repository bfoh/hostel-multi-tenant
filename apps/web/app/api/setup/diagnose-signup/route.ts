import { NextResponse }    from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Diagnostic endpoint — reveals the exact DB error behind
// "Database error saving new user" so we can target the real fix.
// Call: POST /api/setup/diagnose-signup
// Body: { "email": "test@example.com" }
export async function POST(request: Request) {
  const { email } = await request.json().catch(() => ({}))
  const testEmail = email ?? `diag-${Date.now()}@diag-test.internal`

  const admin = createAdminClient()

  // 1. Check what triggers exist on auth.users
  const { data: triggers, error: triggerErr } = await admin.rpc('pg_get_auth_triggers' as never)

  // 2. Try creating a user via the admin API (different code path from client signUp)
  const { data: userData, error: createErr } = await admin.auth.admin.createUser({
    email:         testEmail,
    password:      'Diag-Test-Password-123!',
    email_confirm: false,
  })

  // 3. Clean up the test user if it was created
  if (userData?.user?.id) {
    await admin.auth.admin.deleteUser(userData.user.id)
  }

  return NextResponse.json({
    trigger_query_result: triggerErr
      ? `trigger lookup failed (expected — function not deployed): ${triggerErr.message}`
      : triggers,
    admin_create_result: createErr
      ? { error: createErr.message, status: createErr.status }
      : { ok: true, note: 'Admin createUser succeeded — the issue is specific to the client signUp() path' },
  })
}
