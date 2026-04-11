import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const slug      = request.nextUrl.searchParams.get('slug') ?? ''
  const excludeId = request.nextUrl.searchParams.get('excludeId') ?? ''

  if (!slug) return NextResponse.json({ available: false, error: 'No slug' })

  const normalised = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  if (normalised.length < 2) return NextResponse.json({ available: false, error: 'Too short' })

  const supabase = createAdminClient()
  let query = supabase.from('tenants').select('id').eq('slug', normalised)
  if (excludeId) query = query.neq('id', excludeId)

  const { data } = await query.maybeSingle()
  return NextResponse.json({ available: !data, slug: normalised })
}
