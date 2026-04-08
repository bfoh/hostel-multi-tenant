import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

const schema = z.object({
  name:          z.string().min(2).max(200).optional(),
  primary_color: z.string().optional().nullable(),
  accent_color:  z.string().optional().nullable(),
  logo_url:      z.string().url().optional().nullable(),
  currency:      z.string().length(3).optional(),
  timezone:      z.string().optional(),
  sms_enabled:   z.boolean().optional(),
  email_enabled: z.boolean().optional(),
  momo_enabled:  z.boolean().optional(),
})

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')

  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 401 })
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('tenants')
    .update(parsed.data)
    .eq('id', tenantId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
