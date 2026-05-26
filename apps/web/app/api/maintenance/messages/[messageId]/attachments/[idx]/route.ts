import { NextResponse, type NextRequest } from 'next/server'
import { getServerTenantId } from '@/lib/auth/tenant'
import { requireTenantRole } from '@/lib/auth/tenant-role'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { signedUrlFor } from '@/lib/maintenance/attachments'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ messageId: string; idx: string }> },
) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 400 })

  const ctx = await requireTenantRole(tenantId, ['owner', 'manager', 'housekeeper', 'receptionist', 'accountant'])
  if (ctx instanceof NextResponse) return ctx

  const { messageId, idx } = await params
  const i = Number(idx)
  if (!Number.isFinite(i) || i < 0) return NextResponse.json({ error: 'Bad index' }, { status: 400 })

  const admin = await createTenantAdminClientFromHeaders() as any
  const { data: msg } = await admin
    .from('maintenance_messages')
    .select('attachments')
    .eq('id', messageId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!msg) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const path = msg.attachments?.[i] as string | undefined
  if (!path) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const url = await signedUrlFor(path)
  if (!url) return NextResponse.json({ error: 'Sign failed' }, { status: 500 })
  return NextResponse.json({ url })
}
