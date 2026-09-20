import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { requireTenantRole } from '@/lib/auth/tenant-role'
import { invalidateTenantCache } from '@/lib/tenant/resolve'

/**
 * Owner-only controls for the tenant's public marketplace listing:
 * delist toggle, guest checkout mode, and location (reusing the existing
 * tenants.address_city/address_region columns, not new ones).
 */

const schema = z.object({
  listed_publicly:      z.boolean().optional(),
  booking_payment_mode: z.enum(['online', 'pay_at_hostel']).optional(),
  address_city:         z.string().max(100).optional().nullable(),
  address_region:       z.string().max(100).optional().nullable(),
})

export async function GET() {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const role = await requireTenantRole(tenantId, ['owner'])
  if (role instanceof NextResponse) return role

  const supabase = await createTenantAdminClientFromHeaders()
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('listed_publicly, booking_payment_mode, address_city, address_region, paystack_subaccount_code, slug')
    .eq('id', tenantId)
    .single()

  if (error || !tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  return NextResponse.json(tenant)
}

export async function PATCH(request: NextRequest) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const role = await requireTenantRole(tenantId, ['owner'])
  if (role instanceof NextResponse) return role

  const body   = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })

  const supabase = await createTenantAdminClientFromHeaders()

  if (parsed.data.booking_payment_mode === 'online') {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('paystack_subaccount_code')
      .eq('id', tenantId)
      .single()

    if (!tenant?.paystack_subaccount_code) {
      return NextResponse.json(
        {
          error: 'no_payout_account',
          message: 'Connect a payout bank account in Settings before enabling online payments for guest bookings.',
        },
        { status: 422 },
      )
    }
  }

  const { listed_publicly, booking_payment_mode, address_city, address_region } = parsed.data

  const { error, data: updated } = await supabase
    .from('tenants')
    .update({ listed_publicly, booking_payment_mode, address_city, address_region })
    .eq('id', tenantId)
    .select('slug')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // The directory query reads listed_publicly/city/region live (no cache),
  // but the tenant-resolve cache keys on hostname, not these columns — bust
  // it anyway in case a future field here ever gets folded into that cache.
  if (updated?.slug) await invalidateTenantCache(updated.slug)

  return NextResponse.json({ ok: true })
}
