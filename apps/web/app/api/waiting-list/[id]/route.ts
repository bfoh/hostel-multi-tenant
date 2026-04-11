import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

async function getTenantId() {
  return (await headers()).get('x-tenant-id')
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const tenantId = await getTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const { id } = await params
  const body = await req.json()

  const { error } = await supabase
    .from('waiting_list')
    .update(body)
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const tenantId = await getTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const { id } = await params
  const { error } = await supabase
    .from('waiting_list')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
