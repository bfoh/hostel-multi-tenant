import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { provisionTenant } from '@/lib/onboarding/provision-tenant'

/**
 * POST /api/onboarding/provision
 * Called by new users (no tenant yet) to create their hostel/hotel tenant
 * record. Delegates to the shared provisionTenant() helper (service role,
 * idempotent) — see lib/onboarding/provision-tenant.ts.
 */
export async function POST(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  try {
    const result = await provisionTenant({
      userId: user.id,
      rawName: user.user_metadata?.hostel_name as string | undefined,
    })
    return NextResponse.json(result, { status: result.alreadyExists ? 200 : 201 })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
