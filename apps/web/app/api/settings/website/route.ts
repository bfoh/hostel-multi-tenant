import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { getServerTenantId } from '@/lib/auth/tenant'

const faqSchema = z.object({
  q: z.string().max(300),
  a: z.string().max(1000),
})

const schema = z.object({
  hero_heading:    z.string().max(120).optional().nullable(),
  hero_subheading: z.string().max(300).optional().nullable(),
  about_text:      z.string().max(2000).optional().nullable(),
  amenities:       z.array(z.string().max(60)).max(20).optional(),
  gallery_urls:    z.array(z.string().url().max(500)).max(12).optional(),
  faqs:            z.array(faqSchema).max(20).optional(),
})

export async function PATCH(request: NextRequest) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const body   = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const supabase = await createTenantAdminClientFromHeaders()

  // Fetch existing content and merge so partial saves don't wipe other fields
  const { data: existing } = await supabase
    .from('tenants')
    .select('website_content')
    .eq('id', tenantId)
    .single()

  const merged = { ...(existing?.website_content as Record<string, unknown> ?? {}), ...parsed.data }

  const { error } = await supabase
    .from('tenants')
    .update({ website_content: merged })
    .eq('id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
