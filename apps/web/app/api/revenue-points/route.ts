import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'

/**
 * POST /api/revenue-points — Create a new revenue point
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const body = await req.json().catch(() => null)
  if (!body?.name || !body?.type) {
    return NextResponse.json({ error: 'name and type are required' }, { status: 422 })
  }

  const admin = createAdminClient()

  const { data, error } = await (admin as any)
    .from('revenue_points')
    .insert({
      tenant_id:   tenantId,
      name:        body.name,
      type:        body.type,
      description: body.description ?? null,
      manager_id:  user.id,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A revenue point with this name already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
