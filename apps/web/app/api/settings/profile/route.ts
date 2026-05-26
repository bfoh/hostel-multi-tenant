import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { headers } from 'next/headers'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'

const schema = z.object({
  name:           z.string().min(2).max(200),
  tagline:        z.string().max(200).optional().nullable(),
  contact_phone:  z.string().max(30).optional().nullable(),
  contact_email:  z.string().email().optional().nullable().or(z.literal('')),
  address_line1:  z.string().max(200).optional().nullable(),
  address_city:   z.string().max(100).optional().nullable(),
  address_region: z.string().max(100).optional().nullable(),
  website_url:    z.string().url().optional().nullable().or(z.literal('')),
  custom_domain:  z.string().max(253).optional().nullable().or(z.literal('')),
})

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })

  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  // Use admin client to bypass RLS — tenants table has no UPDATE policy for
  // user-scoped clients. The middleware already validates tenant ownership
  // via the x-tenant-id header derived from JWT claims.
  const supabase = await createTenantAdminClientFromHeaders()

  // Normalise empty strings to null so optional fields (especially
  // custom_domain) don't pollute the column with '' and bypass the domain
  // format check that only fires when the value is truthy.
  const normalised = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) => [k, v === '' ? null : v]),
  ) as typeof parsed.data

  const { error } = await (supabase.from('tenants') as any).update(normalised).eq('id', tenantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
