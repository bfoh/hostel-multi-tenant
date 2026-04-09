import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({
  type:           z.enum(['lost', 'found']),
  item_name:      z.string().min(1).max(200),
  description:    z.string().max(500).optional().nullable(),
  location_found: z.string().max(200).optional().nullable(),
  found_date:     z.string().optional().nullable(),
  owner_name:     z.string().max(200).optional().nullable(),
  owner_phone:    z.string().max(50).optional().nullable(),
  room_number:    z.string().max(20).optional().nullable(),
})

export async function GET() {
  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('lost_found_items')
    .select('*')
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
    .from('lost_found_items')
    .insert({
      tenant_id:    tenantId,
      recorded_by:  user.user?.id,
      status:       'unclaimed',
      ...parsed.data,
      found_date:   parsed.data.found_date ?? undefined,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
