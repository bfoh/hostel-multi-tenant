import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({
  title:          z.string().min(1).max(200),
  description:    z.string().max(1000).optional().nullable(),
  category:       z.enum(['plumbing', 'electrical', 'hvac', 'structural', 'furniture', 'appliance', 'cleaning', 'pest_control', 'security', 'other']),
  priority:       z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  room_id:        z.string().uuid().optional().nullable(),
  contractor_id:  z.string().uuid().optional().nullable(),
  estimated_cost: z.number().int().min(0).optional().nullable(),
  notes:          z.string().max(500).optional().nullable(),
})

export async function GET() {
  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('maintenance_requests')
    .select('*, room:rooms(room_number, block), contractor:contractors(name, phone)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })

  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('maintenance_requests')
    .insert({
      tenant_id:   tenantId,
      reported_by: user.user?.id,
      status:      'open',
      ...parsed.data,
    })
    .select('id, ref_number')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
