import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'

const schema = z.object({
  housekeeping_status: z.enum(['clean', 'dirty', 'inspecting', 'out_of_order']),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const supabase = await createTenantAdminClientFromHeaders()

  const extra: Record<string, unknown> = {}
  if (parsed.data.housekeeping_status === 'clean') {
    extra.last_cleaned_at = new Date().toISOString()
  }
  if (parsed.data.housekeeping_status === 'inspecting') {
    extra.last_inspected_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('rooms')
    .update({ housekeeping_status: parsed.data.housekeeping_status, ...extra })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
