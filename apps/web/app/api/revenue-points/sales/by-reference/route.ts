/**
 * Lookup a revenue point sale by its Paystack reference.
 * Returns 404 until the webhook has written the row.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'

export async function GET(req: NextRequest) {
  const reference = req.nextUrl.searchParams.get('reference')
  if (!reference) return NextResponse.json({ error: 'reference required' }, { status: 400 })

  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createTenantAdminClientFromHeaders()
  const { data } = await supabase
    .from('revenue_point_sales')
    .select('id, total_amount, payment_method, sold_at, description, reference')
    .eq('tenant_id', tenantId)
    .eq('reference', reference)
    .maybeSingle()

  if (!data) return NextResponse.json({ status: 'pending' }, { status: 200 })
  return NextResponse.json({ status: 'completed', sale: data })
}
