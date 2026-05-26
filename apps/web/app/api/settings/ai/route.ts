import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { getServerTenantId } from '@/lib/auth/tenant'

const schema = z.object({
  ai_enabled:      z.boolean(),
  agent_name:      z.string().min(1).max(40),
  personality:     z.enum(['professional', 'friendly', 'casual']),
  language:        z.enum(['en', 'tw']),
  custom_greeting: z.string().max(300).optional().nullable(),
  tools_enabled: z.object({
    check_availability: z.boolean(),
    get_pricing:        z.boolean(),
    search_faqs:        z.boolean(),
    escalate_to_human:  z.boolean(),
  }),
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
  const { error } = await supabase
    .from('tenants')
    .update({ ai_config: parsed.data })
    .eq('id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
