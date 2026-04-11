import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { invalidateTenantCache } from '@/lib/tenant/resolve'

const schema = z.object({
  name:          z.string().min(2).max(200).optional(),
  primary_color: z.string().optional().nullable(),
  accent_color:  z.string().optional().nullable(),
  logo_url:      z.string().url().optional().nullable(),
  currency:      z.string().length(3).optional(),
  timezone:      z.string().optional(),
  sms_enabled:   z.boolean().optional(),
  email_enabled: z.boolean().optional(),
  momo_enabled:  z.boolean().optional(),
})

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const tenantId = await getServerTenantId()
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Fetch slug so we can bust the right cache key
  const { data: tenant } = await admin
    .from('tenants')
    .select('slug, custom_domain')
    .eq('id', tenantId)
    .single()

  const { error } = await admin
    .from('tenants')
    .update(parsed.data)
    .eq('id', tenantId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Bust Redis cache so branding changes take effect immediately
  if (tenant?.slug) {
    const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'gh-hostels.com'
    await invalidateTenantCache(`${tenant.slug}.${appDomain}`)
  }
  if (tenant?.custom_domain) {
    await invalidateTenantCache(tenant.custom_domain)
  }

  return NextResponse.json({ ok: true })
}
