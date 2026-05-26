/**
 * Advance the lifecycle status of a revenue point sale.
 * Used for laundry: received → washing → ready → collected.
 * Restricted to forward transitions; cancellation is a separate concern.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

const schema = z.object({
  status: z.enum(['received', 'washing', 'ready', 'collected']),
})

const ORDER: Record<string, number> = {
  received:  0,
  washing:   1,
  ready:     2,
  collected: 3,
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 422 })
  }

  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('revenue_point_sales')
    .select('id, status')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Sale not found' }, { status: 404 })

  const currentRank = ORDER[(existing as any).status] ?? -1
  const targetRank  = ORDER[parsed.data.status]

  if (currentRank > targetRank) {
    return NextResponse.json(
      { error: `Cannot move from ${(existing as any).status} back to ${parsed.data.status}` },
      { status: 409 },
    )
  }

  const { data, error } = await (supabase.from('revenue_point_sales') as any)
    .update({ status: parsed.data.status })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select('id, status, customer_name, weight_kg, entry_token, sold_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
