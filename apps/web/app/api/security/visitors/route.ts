import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({
  visitor_name:  z.string().min(1).max(200),
  visitor_phone: z.string().optional().nullable(),
  visitor_id:    z.string().optional().nullable(),
  purpose:       z.enum(['visit_occupant', 'delivery', 'maintenance', 'official', 'other']),
  host_name:     z.string().optional().nullable(),
  room_number:   z.string().optional().nullable(),
  vehicle_plate: z.string().optional().nullable(),
  notes:         z.string().max(500).optional().nullable(),
})

export async function GET() {
  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('visitor_log')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('check_in_at', { ascending: false })
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
    .from('visitor_log')
    .insert({
      tenant_id:    tenantId,
      recorded_by:  user.user?.id,
      check_in_at:  new Date().toISOString(),
      ...parsed.data,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
