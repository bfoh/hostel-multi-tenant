import { NextResponse, type NextRequest } from 'next/server'
import { getOccupantSession } from '@/lib/auth/occupant-session'
import { createAdminClient } from '@/lib/supabase/admin'
import { advanceStatus } from '@/lib/food/orders'
import { refundFoodOrder } from '@/lib/food/refund'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getOccupantSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const admin = createAdminClient() as any
  const { data: order } = await admin
    .from('food_orders')
    .select('*, food_order_items(*)')
    .eq('id', id)
    .eq('tenant_id', session.tenantId)
    .eq('occupant_id', session.occupantId)
    .maybeSingle()
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(order)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getOccupantSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const admin = createAdminClient() as any

  const { data: order } = await admin
    .from('food_orders')
    .select('id, status, payment_method, paid_at, paystack_reference, total_pesewas')
    .eq('id', id)
    .eq('tenant_id', session.tenantId)
    .eq('occupant_id', session.occupantId)
    .maybeSingle()
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (order.status !== 'placed') return NextResponse.json({ error: 'Cannot cancel after preparing' }, { status: 409 })

  const result = await advanceStatus(id, session.tenantId, 'cancelled', 'cancelled by occupant')
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })

  if (order.payment_method === 'online' && order.paid_at && order.paystack_reference) {
    refundFoodOrder(order.paystack_reference, order.total_pesewas)
      .catch(err => console.error('[food refund]', err))
  }

  return NextResponse.json({ ok: true })
}
