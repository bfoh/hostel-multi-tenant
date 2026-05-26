import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'

// PATCH /api/blacklist/[id] — lift / deactivate an entry
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createTenantAdminClientFromHeaders()

  const { data: entry } = await supabase
    .from('occupant_blacklist')
    .select('id, occupant_id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('occupant_blacklist')
    .update({ is_active: false })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  // Restore occupant status if no other active ban exists
  if (entry.occupant_id) {
    const { count } = await supabase
      .from('occupant_blacklist')
      .select('id', { count: 'exact', head: true })
      .eq('occupant_id', entry.occupant_id)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .eq('severity', 'banned')

    if ((count ?? 0) === 0) {
      await supabase
        .from('occupants')
        .update({ status: 'active' })
        .eq('id', entry.occupant_id)
        .eq('tenant_id', tenantId)
    }
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/blacklist/[id] — permanently remove
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createTenantAdminClientFromHeaders()

  const { error } = await supabase
    .from('occupant_blacklist')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
