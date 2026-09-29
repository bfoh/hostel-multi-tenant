/**
 * Server-rendered QR code PNG/SVG linking to this tenant's public listing
 * page — for printing/sharing to drive marketplace traffic. Same pattern
 * as the existing revenue-point QR route.
 *
 *   ?size=512      (optional, pixels — default 512, max 1024)
 *   ?format=svg    (optional, return SVG instead of PNG)
 */
import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import QRCode from 'qrcode'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { bareRootDomain } from '@/lib/tenant/host-classification'

export async function GET(req: NextRequest) {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sizeRaw = parseInt(req.nextUrl.searchParams.get('size') ?? '512', 10)
  const size    = Math.min(1024, Math.max(128, Number.isFinite(sizeRaw) ? sizeRaw : 512))
  const format  = req.nextUrl.searchParams.get('format') === 'svg' ? 'svg' : 'png'

  const supabase = await createTenantAdminClientFromHeaders()
  const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', tenantId).single()
  if (!tenant?.slug) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const rootDomain = bareRootDomain(process.env.NEXT_PUBLIC_APP_DOMAIN)
  const target = `https://${rootDomain}/listing/${tenant.slug}`

  const qrOpts = {
    width: size,
    margin: 2,
    errorCorrectionLevel: 'H' as const,
    color: { dark: '#0F172A', light: '#FFFFFF' },
  }

  if (format === 'svg') {
    const svg = await QRCode.toString(target, { ...qrOpts, type: 'svg' })
    return new NextResponse(svg, {
      status: 200,
      headers: { 'content-type': 'image/svg+xml', 'cache-control': 'private, max-age=60' },
    })
  }

  const buffer = await QRCode.toBuffer(target, { ...qrOpts, type: 'png' })
  return new NextResponse(buffer as any, {
    status: 200,
    headers: { 'content-type': 'image/png', 'cache-control': 'private, max-age=60' },
  })
}
