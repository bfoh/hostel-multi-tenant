/**
 * Soft conflict check for sports court booking.
 *
 * Returns active bookings on the requested court — sales whose
 * (sold_at + duration_minutes) extends past now. The customer is shown a
 * warning chip but can still proceed.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; pointId: string }> },
) {
  const { slug, pointId } = await params
  const sp = req.nextUrl.searchParams
  const courtId = sp.get('court_id')
  const durationMinutes = Number(sp.get('duration_minutes') ?? '0')

  if (!courtId) return NextResponse.json({ error: 'court_id required' }, { status: 422 })

  const supabase = createAdminClient()

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('slug', slug).single()
  if (!tenant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Pull the last 6 hours of bookings on this court; client computes overlap.
  const since = new Date(Date.now() - 6 * 3600_000).toISOString()
  const { data, error } = await supabase
    .from('revenue_point_sales')
    .select('id, sold_at, duration_minutes, customer_name')
    .eq('tenant_id', tenant.id)
    .eq('revenue_point_id', pointId)
    .eq('court_id', courtId)
    .gte('sold_at', since)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const now = Date.now()
  const requestedEndsAt = now + (Number.isFinite(durationMinutes) ? durationMinutes : 0) * 60_000

  const conflicts = (data ?? [])
    .map((s: any) => {
      const startMs = new Date(s.sold_at).getTime()
      const endMs   = startMs + (s.duration_minutes ?? 0) * 60_000
      const overlaps = endMs > now && startMs < requestedEndsAt
      return overlaps
        ? {
            id:             s.id,
            ends_at:        new Date(endMs).toISOString(),
            customer_name:  s.customer_name,
          }
        : null
    })
    .filter(Boolean)

  return NextResponse.json({ conflicts })
}
