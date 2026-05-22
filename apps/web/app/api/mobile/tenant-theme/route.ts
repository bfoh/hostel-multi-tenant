import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/mobile/tenant-theme
 * Returns the logged-in user's tenant brand for the mobile shell to
 * cache (native splash + status bar tint on next cold launch).
 *
 *   { tenant_name, logo_url, primary_color }
 *
 * Falls back through tenant_members (owners/staff) then occupants
 * (residents). Unauthenticated → 200 with empty payload.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({})

  const admin = createAdminClient() as any

  const { data: member } = await admin
    .from('tenant_members')
    .select('tenant_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  let tenantId: string | null = member?.tenant_id ?? null

  if (!tenantId) {
    const { data: occ } = await admin
      .from('occupants')
      .select('tenant_id')
      .eq('user_id', user.id)
      .maybeSingle()
    tenantId = occ?.tenant_id ?? null
  }

  if (!tenantId) return NextResponse.json({})

  const { data: tenant } = await admin
    .from('tenants')
    .select('name, logo_url, primary_color')
    .eq('id', tenantId)
    .maybeSingle()

  if (!tenant) return NextResponse.json({})

  return NextResponse.json({
    tenant_name:   tenant.name,
    logo_url:      tenant.logo_url,
    primary_color: tenant.primary_color,
  })
}
