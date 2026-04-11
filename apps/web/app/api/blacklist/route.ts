import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  occupant_id: z.string().uuid().optional(),
  phone:       z.string().min(7).optional(),
  reason:      z.string().min(3).max(500),
  severity:    z.enum(['warning', 'banned']).default('banned'),
  expires_at:  z.string().datetime().optional(),
}).refine((d) => d.occupant_id || d.phone, {
  message: 'occupant_id or phone required',
})

// GET /api/blacklist?active=true
export async function GET(req: NextRequest) {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const active = req.nextUrl.searchParams.get('active') !== 'false'

  const supabase = await createClient()
  let query = supabase
    .from('occupant_blacklist')
    .select('*, occupants(first_name, last_name, phone, email, photo_url)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (active) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/blacklist
export async function POST(req: NextRequest) {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 422 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // If occupant_id given, also update occupant status
  if (parsed.data.occupant_id && parsed.data.severity === 'banned') {
    await supabase
      .from('occupants')
      .update({ status: 'blacklisted' })
      .eq('id', parsed.data.occupant_id)
      .eq('tenant_id', tenantId)
  }

  const { data, error } = await supabase
    .from('occupant_blacklist')
    .insert({
      tenant_id:   tenantId,
      occupant_id: parsed.data.occupant_id,
      phone:       parsed.data.phone,
      reason:      parsed.data.reason,
      severity:    parsed.data.severity,
      expires_at:  parsed.data.expires_at,
      is_active:   true,
      added_by:    user?.id,
    })
    .select('*, occupants(first_name, last_name, phone, email)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
