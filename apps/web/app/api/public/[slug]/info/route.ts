import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'edge'
export const revalidate = 300 // 5 min

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const supabase = createAdminClient()

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('id, name, slug, logo_url, primary_color, tagline, contact_phone, contact_email, address_line1, address_city, address_region, website_url, custom_domain, is_active')
    .eq('slug', slug)
    .single()

  if (error || !tenant || !tenant.is_active) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({
    name:          tenant.name,
    slug:          tenant.slug,
    tagline:       tenant.tagline,
    logo_url:      tenant.logo_url,
    primary_color: tenant.primary_color,
    contact_phone: tenant.contact_phone,
    contact_email: tenant.contact_email,
    address:       [tenant.address_line1, tenant.address_city, tenant.address_region].filter(Boolean).join(', '),
    website_url:   tenant.website_url,
  })
}
