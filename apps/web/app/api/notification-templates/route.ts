import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const EVENT_TYPES = [
  'booking_confirmed', 'booking_cancelled',
  'payment_received', 'payment_reminder',
  'checkin_reminder', 'checkout_reminder',
  'lease_expiry_reminder', 'deposit_refund',
] as const

const schema = z.object({
  event_type: z.enum(EVENT_TYPES),
  channel:    z.enum(['sms', 'email']),
  subject:    z.string().max(200).optional(),
  body:       z.string().min(1).max(2000),
  is_active:  z.boolean().default(true),
})

// GET /api/notification-templates
export async function GET() {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notification_templates')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('event_type')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/notification-templates — upsert (unique on tenant+event_type+channel)
export async function POST(req: NextRequest) {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 422 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notification_templates')
    .upsert(
      { tenant_id: tenantId, ...parsed.data },
      { onConflict: 'tenant_id,event_type,channel' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
