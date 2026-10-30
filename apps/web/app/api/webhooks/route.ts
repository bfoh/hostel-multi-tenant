import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { requireTenantRole } from '@/lib/auth/tenant-role'
import { WEBHOOK_EVENT_TYPES } from '@/lib/webhooks'
import { z } from 'zod'

// Endpoints receive guest and payment data, so only owners and managers may
// see or change them (the settings page is already limited to those roles).
const WEBHOOK_ROLES = ['owner', 'manager'] as const

const schema = z.object({
  url:         z.string().url(),
  events:      z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1),
  description: z.string().max(200).optional(),
  is_active:   z.boolean().default(true),
})

export async function GET() {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = await requireTenantRole(tenantId, WEBHOOK_ROLES)
  if (role instanceof NextResponse) return role

  const supabase = await createTenantAdminClientFromHeaders()
  const { data: endpoints } = await supabase
    .from('webhook_endpoints')
    .select('id, url, events, description, is_active, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  const { data: recentEvents } = await supabase
    .from('webhook_events')
    .select('id, endpoint_id, event_type, status, response_status, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ endpoints: endpoints ?? [], events: recentEvents ?? [] })
}

export async function POST(req: NextRequest) {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = await requireTenantRole(tenantId, WEBHOOK_ROLES)
  if (role instanceof NextResponse) return role

  const supabase = await createTenantAdminClientFromHeaders()
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 422 })

  const { data, error } = await supabase
    .from('webhook_endpoints')
    .insert({ tenant_id: tenantId, ...parsed.data })
    .select('id, url, events, description, is_active, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
