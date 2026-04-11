import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  status:        z.enum(['refunded','forfeited','partial_refund']),
  refund_amount: z.number().int().min(0).optional(),
  refund_reason: z.string().max(500).optional(),
  notes:         z.string().max(500).optional(),
})

// PATCH /api/deposits/[id] — resolve a deposit (refund / forfeit)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()

  const { data: deposit } = await supabase
    .from('damage_deposits')
    .select('id, status, amount')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!deposit) return NextResponse.json({ error: 'Deposit not found' }, { status: 404 })
  if (deposit.status !== 'held') return NextResponse.json({ error: 'Deposit already resolved' }, { status: 400 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 422 })

  if (parsed.data.status === 'partial_refund' && parsed.data.refund_amount == null) {
    return NextResponse.json({ error: 'refund_amount required for partial_refund' }, { status: 422 })
  }
  if (parsed.data.refund_amount != null && parsed.data.refund_amount > deposit.amount) {
    return NextResponse.json({ error: 'Refund amount cannot exceed deposit amount' }, { status: 400 })
  }

  const update: Record<string, unknown> = {
    status:       parsed.data.status,
    resolved_at:  new Date().toISOString(),
    refund_reason: parsed.data.refund_reason,
    notes:        parsed.data.notes,
  }
  if (parsed.data.status === 'refunded') update.refund_amount = deposit.amount
  if (parsed.data.status === 'forfeited') update.refund_amount = 0
  if (parsed.data.status === 'partial_refund') update.refund_amount = parsed.data.refund_amount

  const { data, error } = await (supabase.from('damage_deposits') as any)
    .update(update)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/deposits/[id] — remove an unresolved deposit record
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()

  const { data: deposit } = await supabase
    .from('damage_deposits')
    .select('id, status')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!deposit) return NextResponse.json({ error: 'Deposit not found' }, { status: 404 })
  if (deposit.status !== 'held') return NextResponse.json({ error: 'Cannot delete a resolved deposit' }, { status: 400 })

  const { error } = await supabase
    .from('damage_deposits')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
