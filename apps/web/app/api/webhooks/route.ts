import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const VALID_EVENTS = [
  '*',
  'booking.created', 'booking.confirmed', 'booking.checked_in', 'booking.checked_out', 'booking.cancelled',
  'payment.received',
  'maintenance.created', 'maintenance.resolved',
  'occupant.created',
]

const schema = z.object({
  url:         z.string().url(),
  events:      z.array(z.enum(VALID_EVENTS as [string, ...string[]])).min(1),
  description: z.string().max(200).optional(),
  is_active:   z.boolean().default(true),
})

export async function GET() {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
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

  const supabase = createAdminClient()
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
