import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { invalidateTenantCache } from '@/lib/tenant/resolve'

const BANK_FIELDS = [
  'bank_name',
  'bank_branch',
  'bank_account_name',
  'bank_account_number',
  'bank_swift_code',
  'bank_instructions',
  'bank_deposits_enabled',
] as const

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
  // Bank deposit details (migration 055)
  bank_name:             z.string().max(120).optional().nullable(),
  bank_branch:           z.string().max(120).optional().nullable(),
  bank_account_name:     z.string().max(120).optional().nullable(),
  bank_account_number:   z.string().regex(/^[0-9 -]{6,40}$/, 'Account number must be 6+ digits').optional().nullable(),
  bank_swift_code:       z.string().regex(/^[A-Z0-9]{8}([A-Z0-9]{3})?$/, 'Invalid SWIFT/BIC').optional().nullable(),
  bank_instructions:     z.string().max(280).optional().nullable(),
  bank_deposits_enabled: z.boolean().optional(),
  // Food ordering settings (migration 060)
  food_orders_enabled:   z.boolean().optional(),
  food_cutoff_time:      z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  food_ready_sms:        z.boolean().optional(),
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

  // Bank deposit fields are owner-only. Other branding fields stay open
  // to anyone the page-level role gate already trusts.
  const touchesBankFields = BANK_FIELDS.some((f) => f in (parsed.data as Record<string, unknown>))
  if (touchesBankFields) {
    const callerRole = (await headers()).get('x-tenant-role')
    if (callerRole !== 'owner') {
      return NextResponse.json({ error: 'Owner role required to change bank deposit details' }, { status: 403 })
    }
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
    .update(parsed.data as any)
    .eq('id', tenantId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Auto-enable bank deposits when the required fields just became complete
  // and the owner hasn't explicitly set the toggle in this request. The form
  // only sends `bank_deposits_enabled` after the user actually clicks the
  // checkbox; otherwise it omits the key.
  const requiredFilled =
    parsed.data.bank_name           &&
    parsed.data.bank_account_name   &&
    parsed.data.bank_account_number
  const userDidNotSetToggle = !('bank_deposits_enabled' in (parsed.data as Record<string, unknown>))
  if (requiredFilled && userDidNotSetToggle) {
    await admin
      .from('tenants')
      .update({ bank_deposits_enabled: true } as any)
      .eq('id', tenantId)
      .eq('bank_deposits_enabled' as any, false)
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
