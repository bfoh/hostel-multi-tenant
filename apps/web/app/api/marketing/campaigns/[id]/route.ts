import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()

  // Only a draft can be deleted — a sent campaign is a record of what
  // actually went out, not something to quietly erase.
  const { error } = await supabase
    .from('marketing_campaigns')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .eq('status', 'draft')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
