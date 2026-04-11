import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { widgetCorsHeaders, corsPreflightResponse, checkOrigin } from '@/lib/widget-cors'

export const runtime = 'edge'

export async function OPTIONS(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = createAdminClient()
  const { data: tenant } = await supabase.from('tenants').select('widget_domains').eq('slug', slug).single()
  const cors = widgetCorsHeaders(req.headers.get('origin'), (tenant?.widget_domains ?? []) as string[])
  return corsPreflightResponse(cors)
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug }  = await params
  const origin    = req.headers.get('origin')
  const supabase  = createAdminClient()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, is_active, widget_domains')
    .eq('slug', slug)
    .single()

  if (!tenant || !tenant.is_active) {
    return NextResponse.json({ error: 'Hostel not found' }, { status: 404 })
  }

  const domains = (tenant.widget_domains ?? []) as string[]
  const cors    = widgetCorsHeaders(origin, domains)

  if (!checkOrigin(origin, domains)) {
    return NextResponse.json({ error: 'Origin not allowed' }, { status: 403, headers: cors })
  }

  const { data: categories } = await supabase
    .from('room_categories')
    .select('id, name, type, base_rate, rate_unit, capacity, amenities, description, rooms:rooms(id, status)')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('sort_order')

  const result = (categories ?? []).map((cat) => {
    const rooms = Array.isArray(cat.rooms) ? cat.rooms : []
    const available_count = rooms.filter((r: any) => r.status === 'available').length
    const { rooms: _, ...rest } = cat
    return { ...rest, available_count }
  }).filter((c) => c.available_count > 0)

  return NextResponse.json(result, { headers: { ...cors, 'Cache-Control': 'public, max-age=60' } })
}
