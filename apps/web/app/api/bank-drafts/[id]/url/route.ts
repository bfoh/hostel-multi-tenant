import { NextResponse, type NextRequest } from 'next/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { requireTenantRole } from '@/lib/auth/tenant-role'
import { getSignedDraftUrl } from '@/lib/bank-draft'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 400 })

  const ctx = await requireTenantRole(tenantId, ['owner', 'accountant'])
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  const admin  = await createTenantAdminClientFromHeaders()
  const { data: rowRaw } = await admin
    .from('booking_payments')
    .select('draft_file_path')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  const row = rowRaw as { draft_file_path: string | null } | null

  if (!row?.draft_file_path) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const url = await getSignedDraftUrl(row.draft_file_path, 600)
  if (!url) return NextResponse.json({ error: 'Could not sign URL' }, { status: 500 })
  return NextResponse.json({ url })
}
