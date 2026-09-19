import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveMobileContext } from '@/lib/auth/mobile-context'

/**
 * GET /api/mobile/tenant-theme
 * Returns the logged-in user's tenant brand for the mobile shell to
 * cache (native splash + status bar tint on next cold launch).
 *
 *   { tenant_name, logo_url, primary_color }
 *
 * Falls back through tenant_members (owners/staff) then occupants
 * (residents) via resolveMobileContext. Unauthenticated → 200 with empty
 * payload.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({})

  const ctx = await resolveMobileContext(user.id)
  if (!ctx.tenantId) return NextResponse.json({})

  const admin = createAdminClient() as any
  const { data: tenant } = await admin
    .from('tenants')
    .select('name, logo_url, primary_color')
    .eq('id', ctx.tenantId)
    .maybeSingle()

  if (!tenant) return NextResponse.json({})

  return NextResponse.json({
    tenant_name:   tenant.name,
    logo_url:      tenant.logo_url,
    primary_color: tenant.primary_color,
  })
}
