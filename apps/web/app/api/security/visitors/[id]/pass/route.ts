import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'

/**
 * GET /api/security/visitors/[id]/pass
 * Returns a visitor pass page (HTML) or JSON with QR data URL.
 * The QR encodes a scan URL that the guard uses to log entry.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { id } = await params

  const admin = await createTenantAdminClientFromHeaders()
  const { data: visitor } = await admin
    .from('visitor_logs')
    .select('id, visitor_name, host_name, pass_token, expected_at, pass_status, purpose')
    .eq('id', id)
    .single()

  if (!visitor) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!visitor.pass_token) return NextResponse.json({ error: 'No pass token' }, { status: 400 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const scanUrl = `${appUrl}/api/security/visitors/scan/${visitor.pass_token}`

  const qrDataUrl = await QRCode.toDataURL(scanUrl, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 256,
  })

  return NextResponse.json({
    visitor,
    scanUrl,
    qrDataUrl,
  })
}
