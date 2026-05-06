import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getOccupantSession } from '@/lib/auth/occupant-session'
import { createAdminClient } from '@/lib/supabase/admin'
import { OrderTracker } from '@/components/occupant-portal/food/order-tracker'

export const metadata: Metadata = { title: 'Order · Food' }

export default async function OrderTrackerPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getOccupantSession()
  if (!session) redirect('/login')

  const { id } = await params
  const admin = createAdminClient() as any
  const { data: order } = await admin
    .from('food_orders')
    .select('*, food_order_items(*)')
    .eq('id', id)
    .eq('tenant_id', session.tenantId)
    .eq('occupant_id', session.occupantId)
    .maybeSingle()
  if (!order) notFound()

  return (
    <div className="space-y-3">
      <Link href="/occupant-portal/food" className="inline-flex items-center gap-1 text-xs text-slate-500">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to menu
      </Link>
      <OrderTracker initial={order} color={session.tenantColor} />
    </div>
  )
}
