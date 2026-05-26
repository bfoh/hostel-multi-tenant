import { NextResponse, type NextRequest } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'

import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { insertEnquiry, fireNotifications, type EnquiryInput } from '@/lib/enquiries/intake'

// Server-to-server enquiry webhook. Used by external form services (Readdy.ai,
// FormBold, Zapier, custom scripts) that can't satisfy a browser-CORS Origin
// gate. Authentication is by a per-tenant shared secret stored in
// tenants.enquiry_webhook_secret.
//
// Accepted secret transports (whichever the upstream service supports):
//   1. Header: `x-enquiry-secret: <secret>`
//   2. Header: `authorization: Bearer <secret>`
//   3. Query param: `?secret=<secret>`
//   4. HMAC header: `x-enquiry-signature: sha256=<hex>` over the raw body
//
// Accepted bodies:
//   - application/json
//   - application/x-www-form-urlencoded
//   - multipart/form-data
//
// Field-name aliases below cover the Readdy form ("move_in_date",
// "room_type") and the platform's canonical names interchangeably.

export const runtime = 'nodejs'

const FIELD_ALIASES: Record<string, keyof EnquiryInput> = {
  full_name:          'full_name',
  fullname:           'full_name',
  name:               'full_name',
  phone:              'phone',
  phone_number:       'phone',
  phonenumber:        'phone',
  tel:                'phone',
  email:              'email',
  email_address:      'email',
  preferred_move_in:  'preferred_move_in',
  move_in_date:       'preferred_move_in',
  moveindate:         'preferred_move_in',
  movein_date:        'preferred_move_in',
  room_of_interest:   'room_of_interest',
  room_type:          'room_of_interest',
  roomtype:           'room_of_interest',
  room:               'room_of_interest',
  category_id:        'category_id',
  message:            'message',
  enquiry:            'message',
  your_enquiry:       'message',
  notes:              'message',
}

function extractSecret(req: NextRequest, url: URL): string | null {
  const header = req.headers.get('x-enquiry-secret')
  if (header) return header.trim()
  const auth = req.headers.get('authorization')
  if (auth?.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim()
  const query = url.searchParams.get('secret')
  if (query) return query.trim()
  return null
}

function constantTimeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) return false
  return timingSafeEqual(aBuf, bBuf)
}

function verifyHmac(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false
  const cleaned = signature.startsWith('sha256=') ? signature.slice(7) : signature
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  return constantTimeEqual(cleaned, expected)
}

async function parseBody(req: NextRequest, rawBody: string): Promise<Record<string, unknown> | null> {
  const ct = (req.headers.get('content-type') ?? '').toLowerCase()

  if (ct.includes('application/json')) {
    try { return JSON.parse(rawBody) as Record<string, unknown> } catch { return null }
  }

  if (ct.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(rawBody)
    return Object.fromEntries(params.entries())
  }

  if (ct.includes('multipart/form-data')) {
    // Re-create a Request because we already consumed the body as text.
    try {
      const fd = await new Request('http://x', {
        method:  'POST',
        headers: { 'content-type': ct },
        body:    rawBody,
      }).formData()
      const out: Record<string, unknown> = {}
      fd.forEach((v, k) => { out[k] = typeof v === 'string' ? v : v.name })
      return out
    } catch { return null }
  }

  // Last-ditch attempt — try JSON, then form-urlencoded.
  try { return JSON.parse(rawBody) as Record<string, unknown> } catch { /* fall through */ }
  try { return Object.fromEntries(new URLSearchParams(rawBody).entries()) } catch { return null }
}

function normaliseFields(raw: Record<string, unknown>): EnquiryInput | { error: string } {
  const out: Partial<EnquiryInput> = {}
  for (const [k, v] of Object.entries(raw)) {
    const key = FIELD_ALIASES[k.toLowerCase()]
    if (!key) continue
    if (v === null || v === undefined) continue
    const str = String(v).trim()
    if (!str) continue
    ;(out as Record<string, string>)[key] = str
  }

  if (!out.full_name || out.full_name.length < 2) return { error: 'full_name required' }
  if (!out.phone     || out.phone.length     < 7) return { error: 'phone required' }
  if (out.full_name.length > 120) out.full_name = out.full_name.slice(0, 120)
  if (out.phone.length     > 32)  out.phone     = out.phone.slice(0, 32)

  if (out.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) delete out.email
  if (out.preferred_move_in && !/^\d{4}-\d{2}-\d{2}$/.test(out.preferred_move_in)) delete out.preferred_move_in
  if (out.category_id && !/^[0-9a-f-]{36}$/i.test(out.category_id)) delete out.category_id
  if (out.message && out.message.length > 2000) out.message = out.message.slice(0, 2000)
  if (out.room_of_interest && out.room_of_interest.length > 120) out.room_of_interest = out.room_of_interest.slice(0, 120)

  return out as EnquiryInput
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const url = new URL(req.url)
  const supabase = await createTenantAdminClientFromHeaders()

  const { data: tenantRow } = await (supabase
    .from('tenants') as any)
    .select('id, name, slug, primary_color, contact_phone, logo_url, enquiry_webhook_secret, is_active')
    .eq('slug', slug)
    .single()
  const tenant = tenantRow as {
    id: string
    name: string
    slug: string
    primary_color: string | null
    contact_phone: string | null
    logo_url: string | null
    enquiry_webhook_secret: string | null
    is_active: boolean
  } | null

  if (!tenant || !tenant.is_active) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!tenant.enquiry_webhook_secret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  }

  const rawBody = await req.text()

  const presented = extractSecret(req, url)
  const hmacHeader = req.headers.get('x-enquiry-signature')
  const ok =
    (presented && constantTimeEqual(presented, tenant.enquiry_webhook_secret)) ||
    verifyHmac(rawBody, hmacHeader, tenant.enquiry_webhook_secret)
  if (!ok) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
  }

  const parsed = await parseBody(req, rawBody)
  if (!parsed) return NextResponse.json({ error: 'Unparseable body' }, { status: 400 })

  const normalised = normaliseFields(parsed)
  if ('error' in normalised) {
    return NextResponse.json({ error: normalised.error }, { status: 422 })
  }

  const result = await insertEnquiry(
    {
      id:            tenant.id,
      name:          tenant.name,
      primary_color: tenant.primary_color,
      contact_phone: tenant.contact_phone,
      logo_url:      tenant.logo_url,
    },
    normalised,
  )
  if ('error' in result) {
    return NextResponse.json({ error: 'Could not save enquiry' }, { status: 500 })
  }

  fireNotifications(
    {
      id:            tenant.id,
      name:          tenant.name,
      primary_color: tenant.primary_color,
      contact_phone: tenant.contact_phone,
      logo_url:      tenant.logo_url,
    },
    result.id,
    normalised,
  )

  return NextResponse.json({ ok: true, id: result.id }, { status: 201 })
}
