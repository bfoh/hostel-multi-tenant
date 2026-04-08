import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({
  status:         z.enum(['open', 'in_progress', 'on_hold', 'completed', 'cancelled']).optional(),
  priority:       z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  contractor_id:  z.string().uuid().optional().nullable(),
  actual_cost:    z.number().int().min(0).optional().nullable(),
  scheduled_date: z.string().optional().nullable(),
  resolved_at:    z.string().optional().nullable(),
  notes:          z.string().max(500).optional().nullable(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })

  const supabase = await createClient()

  const update = { ...parsed.data }
  if (parsed.data.status === 'completed' && !parsed.data.resolved_at) {
    Object.assign(update, { resolved_at: new Date().toISOString() })
  }

  const { error } = await supabase
    .from('maintenance_requests')
    .update(update)
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const supabase = await createClient()
  const { error } = await supabase
    .from('maintenance_requests')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
