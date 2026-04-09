import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'edge'
export const revalidate = 60 // 1 min — availability changes frequently

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const supabase = createAdminClient()

  // Resolve tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, is_active')
    .eq('slug', slug)
    .single()

  if (!tenant || !tenant.is_active) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Fetch active categories with available room count
  const { data: categories, error } = await supabase
    .from('room_categories')
    .select(`
      id, name, type, base_rate, rate_unit, capacity, amenities, description, image_urls, sort_order,
      rooms(id, status)
    `)
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result = (categories ?? []).map(cat => {
    const rooms = Array.isArray(cat.rooms) ? cat.rooms : []
    const available = rooms.filter(r => r.status === 'available').length
    const total     = rooms.length
    return {
      id:          cat.id,
      name:        cat.name,
      type:        cat.type,
      base_rate:   cat.base_rate,
      rate_unit:   cat.rate_unit,
      capacity:    cat.capacity,
      amenities:   cat.amenities ?? [],
      description: cat.description,
      image_urls:  cat.image_urls ?? [],
      available,
      total,
    }
  })

  return NextResponse.json(result)
}
