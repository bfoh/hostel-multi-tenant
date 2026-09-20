import { NextResponse, type NextRequest } from 'next/server'
import { searchHostels } from '@/lib/directory'

/**
 * Public, unauthenticated, cross-tenant hostel search — powers the /hostels
 * directory and the homepage's "Featured hostels" section. Unlike every
 * other /api/public/[slug]/* route (scoped to one tenant by slug), this one
 * deliberately spans tenants, so it lives at a plain path rather than under
 * a [slug] segment. Query logic lives in lib/directory.ts, shared with the
 * server-rendered pages so they don't self-fetch this route.
 */
export const runtime = 'edge'
export const revalidate = 60

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  try {
    const result = await searchHostels({
      city:   searchParams.get('city'),
      region: searchParams.get('region'),
      q:      searchParams.get('q'),
      page:   Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1),
    })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
