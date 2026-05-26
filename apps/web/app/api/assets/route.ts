import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { generateQrCode } from '@/lib/data/assets'

const schema = z.object({
  name:           z.string().min(1).max(120),
  category:       z.string().max(60).default('general'),
  description:    z.string().max(500).optional().nullable(),
  brand:          z.string().max(80).optional().nullable(),
  model:          z.string().max(80).optional().nullable(),
  serial_number:  z.string().max(80).optional().nullable(),
  room_id:        z.string().uuid().optional().nullable(),
  location_note:  z.string().max(200).optional().nullable(),
  purchase_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  purchase_price: z.number().int().min(0).optional().nullable(),  // pesewas
  supplier:       z.string().max(100).optional().nullable(),
  warranty_expiry:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  condition:      z.enum(['excellent', 'good', 'fair', 'poor']).default('good'),
  notes:          z.string().max(500).optional().nullable(),
})

export async function POST(request: NextRequest) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  const body   = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const supabase = await createTenantAdminClientFromHeaders()

  // Generate unique QR code (retry up to 5 times on collision)
  let qr_code = ''
  for (let i = 0; i < 5; i++) {
    const candidate = generateQrCode()
    const { count } = await supabase
      .from('assets')
      .select('id', { count: 'exact', head: true })
      .eq('qr_code', candidate)
    if (count === 0) { qr_code = candidate; break }
  }
  if (!qr_code) return NextResponse.json({ error: 'Could not generate unique QR code' }, { status: 500 })

  const { data, error } = await (supabase.from('assets') as any)
    .insert({ ...parsed.data, tenant_id: tenantId, qr_code })
    .select('id, qr_code')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
