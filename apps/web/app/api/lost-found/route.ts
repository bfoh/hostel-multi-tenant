import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getServerTenantId } from '@/lib/auth/tenant'

const schema = z.object({
  description:    z.string().min(1).max(500),
  category:       z.enum(['electronics','clothing','documents','keys','money','jewellery','bag','other']).default('other'),
  found_date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  found_location: z.string().max(200).optional().nullable(),
  occupant_id:    z.string().uuid().optional().nullable(),
  room_id:        z.string().uuid().optional().nullable(),
  notes:          z.string().max(500).optional().nullable(),
})

export async function POST(request: NextRequest) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const body   = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('lost_found_items')
    .insert({ ...parsed.data, tenant_id: tenantId })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
