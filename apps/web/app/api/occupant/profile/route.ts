import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createTenantAdminClient } from '@/lib/supabase/tenant-admin'
import { getServerTenantId } from '@/lib/auth/tenant'

const updateSchema = z.object({
  first_name:  z.string().min(1).max(100).optional(),
  last_name:   z.string().min(1).max(100).optional(),
  phone:       z.string().min(9).max(20).optional(),
  institution: z.string().max(200).optional().nullable(),
  programme:   z.string().max(200).optional().nullable(),
  student_id:  z.string().max(50).optional().nullable(),
})

// PATCH /api/occupant/profile — update own profile
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 400 })

  const body   = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const admin = createTenantAdminClient(tenantId)

  const { data: occupant } = await admin
    .from('occupants')
    .select('id')
    .eq('user_id', user.id as any)
    .eq('tenant_id', tenantId)
    .single()

  if (!occupant) return NextResponse.json({ error: 'Occupant not found' }, { status: 404 })

  const updates: Record<string, any> = {}
  if (parsed.data.first_name  !== undefined) updates.first_name  = parsed.data.first_name
  if (parsed.data.last_name   !== undefined) updates.last_name   = parsed.data.last_name
  if (parsed.data.phone       !== undefined) updates.phone       = parsed.data.phone
  if (parsed.data.institution !== undefined) updates.institution = parsed.data.institution
  if (parsed.data.programme   !== undefined) updates.programme   = parsed.data.programme
  if (parsed.data.student_id  !== undefined) updates.student_id  = parsed.data.student_id

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, message: 'No changes' })
  }

  const { error } = await (admin.from('occupants') as any)
    .update(updates)
    .eq('id', occupant.id)
    .eq('tenant_id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
