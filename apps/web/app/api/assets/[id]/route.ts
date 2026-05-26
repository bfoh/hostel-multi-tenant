import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { getServerTenantId } from '@/lib/auth/tenant'

const schema = z.object({
  name:           z.string().min(1).max(120).optional(),
  category:       z.string().max(60).optional(),
  description:    z.string().max(500).optional().nullable(),
  brand:          z.string().max(80).optional().nullable(),
  model:          z.string().max(80).optional().nullable(),
  serial_number:  z.string().max(80).optional().nullable(),
  room_id:        z.string().uuid().optional().nullable(),
  location_note:  z.string().max(200).optional().nullable(),
  purchase_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  purchase_price: z.number().int().min(0).optional().nullable(),
  supplier:       z.string().max(100).optional().nullable(),
  warranty_expiry:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  status:         z.enum(['active', 'maintenance', 'disposed', 'lost']).optional(),
  condition:      z.enum(['excellent', 'good', 'fair', 'poor']).optional(),
  notes:          z.string().max(500).optional().nullable(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const { id }   = await params
  const body     = await request.json().catch(() => null)
  const parsed   = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })

  const supabase = await createTenantAdminClientFromHeaders()
  const { error } = await (supabase.from('assets') as any)
    .update(parsed.data)
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const { id } = await params
  const supabase = await createTenantAdminClientFromHeaders()
  await supabase.from('assets').delete().eq('id', id).eq('tenant_id', tenantId)
  return NextResponse.json({ ok: true })
}
