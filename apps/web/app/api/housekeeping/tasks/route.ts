import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { headers } from 'next/headers'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'

const createSchema = z.object({
  room_id:     z.string().uuid(),
  assigned_to: z.string().uuid().optional().nullable(),
  priority:    z.enum(['urgent', 'high', 'normal', 'low']).default('normal'),
  notes:       z.string().max(500).optional().nullable(),
  due_by:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
})

export async function POST(req: NextRequest) {
  const headersList = await headers()
  const tenantId    = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const supabase = await createTenantAdminClientFromHeaders()
  const { data, error } = await supabase
    .from('housekeeping_tasks')
    .insert({ tenant_id: tenantId, source: 'manual', status: 'pending', ...parsed.data })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
