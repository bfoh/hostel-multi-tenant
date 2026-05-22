import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

import { createAdminClient } from '@/lib/supabase/admin'
import { insertEnquiry, fireNotifications } from '@/lib/enquiries/intake'

// Browser-facing public POST. Origin must match the tenant's website_url
// (or the platform's own APP_DOMAIN for previews). Uses the service-role
// admin client because visitors aren't authenticated against Supabase Auth;
// existing tenant_members RLS still gates dashboard reads.
//
// External form services that can't honour an Origin header (Readdy.ai,
// Zapier, custom backends) should hit /api/webhooks/enquiry/[slug] instead.

export const runtime = 'nodejs'

const schema = z.object({
  full_name:           z.string().trim().min(2).max(120),
  phone:               z.string().trim().min(7).max(32),
  email:               z.string().trim().email().max(160).optional().or(z.literal('').transform(() => undefined)),
  preferred_move_in:   z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('').transform(() => undefined)),
  category_id:         z.string().trim().uuid().optional().or(z.literal('').transform(() => undefined)),
  room_of_interest:    z.string().trim().max(120).optional(),
  message:             z.string().trim().max(2000).optional().or(z.literal('').transform(() => undefined)),
  // honeypot — bots fill hidden fields. Must be empty when present.
  website:             z.string().max(0).optional(),
})

function originAllowed(origin: string | null, websiteUrl: string | null): boolean {
  if (!origin) return false
  let originHost: string
  try { originHost = new URL(origin).host.toLowerCase() } catch { return false }

  const appDomain = (process.env.APP_DOMAIN ?? process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'gh-hostels.com').toLowerCase()
  if (originHost === appDomain || originHost.endsWith(`.${appDomain}`)) return true
  if (!websiteUrl) return false
  try {
    const allowedHost = new URL(websiteUrl).host.toLowerCase()
    if (originHost === allowedHost) return true
    if (originHost === `www.${allowedHost}`) return true
    if (`www.${originHost}` === allowedHost) return true
  } catch { /* ignore malformed website_url */ }
  return false
}

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin':  origin ?? '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age':       '600',
    'Vary':                         'Origin',
  }
}

export async function OPTIONS(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const origin = req.headers.get('origin')

  const supabase = createAdminClient()
  const { data: tenant } = await supabase
    .from('tenants')
    .select('website_url, is_active')
    .eq('slug', slug)
    .single()

  if (!tenant || !tenant.is_active) {
    return new NextResponse(null, { status: 204 })
  }
  if (!originAllowed(origin, tenant.website_url)) {
    return new NextResponse(null, { status: 204 })
  }
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const origin = req.headers.get('origin')
  const supabase = createAdminClient()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, slug, primary_color, contact_phone, website_url, is_active, logo_url')
    .eq('slug', slug)
    .single()

  if (!tenant || !tenant.is_active) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!originAllowed(origin, tenant.website_url)) {
    return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 422, headers: corsHeaders(origin) },
    )
  }

  const result = await insertEnquiry(
    {
      id:            tenant.id,
      name:          tenant.name,
      primary_color: tenant.primary_color,
      contact_phone: tenant.contact_phone,
      logo_url:      tenant.logo_url,
    },
    parsed.data,
  )
  if ('error' in result) {
    return NextResponse.json(
      { error: 'Could not save enquiry' },
      { status: 500, headers: corsHeaders(origin) },
    )
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
    parsed.data,
  )

  return NextResponse.json(
    { ok: true, id: result.id },
    { status: 201, headers: corsHeaders(origin) },
  )
}
