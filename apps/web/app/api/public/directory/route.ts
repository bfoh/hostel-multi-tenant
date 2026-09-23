import { NextResponse, type NextRequest } from 'next/server'
import { searchListings } from '@/lib/directory'
import type { BusinessType } from '@/lib/tenant/host-classification'

/**
 * Public, unauthenticated, cross-tenant listing search — powers the /browse
 * directory and the homepage's "Featured" section, for either vertical.
 * Unlike every other /api/public/[slug]/* route (scoped to one tenant by
 * slug), this one deliberately spans tenants, so it lives at a plain path
 * rather than under a [slug] segment. Query logic lives in lib/directory.ts,
 * shared with the server-rendered pages so they don't self-fetch this route.
 *
 * Which vertical to search comes from middleware's x-business-type header
 * (derived from which vertical root the request came in on — see
 * middleware.ts), with an explicit ?type= query param as an override for
 * callers without that host context.
 */
export const runtime = 'edge'
export const revalidate = 60

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const businessType = (searchParams.get('type') ?? req.headers.get('x-business-type') ?? 'hostel') as BusinessType

  try {
    const result = await searchListings({
      businessType,
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
