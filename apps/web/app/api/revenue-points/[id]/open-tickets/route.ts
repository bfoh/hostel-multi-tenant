/**
 * List open service tickets for a revenue point (laundry workflow today).
 * Returns sales whose status is received / washing / ready, newest first.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createTenantAdminClientFromHeaders()

  const { data, error } = await supabase
    .from('revenue_point_sales')
    .select('id, status, customer_name, weight_kg, entry_token, total_amount, sold_at')
    .eq('tenant_id', tenantId)
    .eq('revenue_point_id', id)
    .in('status', ['received', 'washing', 'ready'])
    .order('sold_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
