/**
 * Server-rendered QR code PNG for a revenue point's public walk-in portal.
 *
 *   ?size=512      (optional, pixels — default 512, max 1024)
 *   ?format=svg    (optional, return SVG instead of PNG)
 *
 * Restaurant / cafeteria points target the food-ordering portal at
 * /order/<slug>; gym / sports / laundry target the walk-in visit page at
 * /visit/<slug>/<pointId>.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import QRCode from 'qrcode'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sizeRaw = parseInt(req.nextUrl.searchParams.get('size') ?? '512', 10)
  const size    = Math.min(1024, Math.max(128, Number.isFinite(sizeRaw) ? sizeRaw : 512))
  const format  = req.nextUrl.searchParams.get('format') === 'svg' ? 'svg' : 'png'

  const supabase = await createTenantAdminClientFromHeaders()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('slug')
    .eq('id', tenantId)
    .single()
  if (!tenant?.slug) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const { data: point } = await supabase
    .from('revenue_points')
    .select('id, type, public_enabled')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!point) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const type = (point as any).type as string
  const isRestaurant = type === 'restaurant' || type === 'cafeteria'

  const host  = req.headers.get('host') ?? 'localhost:3000'
  const proto = host.includes('localhost') ? 'http' : 'https'
  const base  = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`
  const target = isRestaurant
    ? `${base}/order/${tenant.slug}`
    : `${base}/visit/${tenant.slug}/${id}`

  const qrOpts = {
    width: size,
    margin: 2,
    errorCorrectionLevel: 'H' as const,
    color: { dark: '#0F172A', light: '#FFFFFF' },
  }

  if (format === 'svg') {
    const svg = await QRCode.toString(target, { ...qrOpts, type: 'svg' })
    return new NextResponse(svg, {
      status:  200,
      headers: {
        'content-type':  'image/svg+xml',
        'cache-control': 'private, max-age=60',
      },
    })
  }

  const buffer = await QRCode.toBuffer(target, { ...qrOpts, type: 'png' })
  return new NextResponse(buffer as any, {
    status:  200,
    headers: {
      'content-type':  'image/png',
      'cache-control': 'private, max-age=60',
    },
  })
}
