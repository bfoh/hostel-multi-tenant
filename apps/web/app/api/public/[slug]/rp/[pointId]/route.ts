/**
 * Public read endpoint for a walk-in revenue point page.
 *
 * Returns tenant branding + revenue point details (name, type, config) so
 * the public visit page can render the right flow without authentication.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { readPublicConfig, type RevenuePointType } from '@/lib/walkin-pricing'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; pointId: string }> },
) {
  const { slug, pointId } = await params
  const supabase = createAdminClient()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, slug, logo_url, primary_color, contact_phone, paystack_subaccount_code')
    .eq('slug', slug)
    .single()

  if (!tenant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: point } = await supabase
    .from('revenue_points')
    .select('id, name, type, is_active, public_enabled, public_config')
    .eq('id', pointId)
    .eq('tenant_id', tenant.id)
    .single()

  if (!point || !(point as any).is_active || !(point as any).public_enabled) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  const type   = (point as any).type as RevenuePointType
  const config = readPublicConfig(type, (point as any).public_config)

  if (!config) {
    return NextResponse.json(
      { error: 'This service has not been configured for online payment yet.' },
      { status: 409 },
    )
  }

  return NextResponse.json({
    tenant: {
      id:            tenant.id,
      name:          tenant.name,
      slug:          tenant.slug,
      logo_url:      tenant.logo_url,
      primary_color: tenant.primary_color ?? '#2563EB',
      contact_phone: tenant.contact_phone,
      paystack_ready: !!tenant.paystack_subaccount_code,
    },
    point: {
      id:   (point as any).id,
      name: (point as any).name,
      type,
      config,
    },
  })
}
