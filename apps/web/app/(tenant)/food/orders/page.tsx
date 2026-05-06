import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { OrderQueue } from '@/components/food/order-queue'

export const metadata: Metadata = { title: 'Food orders · Kitchen' }

export default async function FoodOrdersPage() {
  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) redirect('/login')

  const admin = createAdminClient() as any
  const { data: orders } = await admin
    .from('food_orders')
    .select('*, food_order_items(*), occupant:occupants(first_name, last_name, phone)')
    .eq('tenant_id', tenantId)
    .in('status', ['placed','preparing','ready'])
    .order('placed_at', { ascending: true })
    .limit(200)

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold text-text-primary">Kitchen queue</h1>
        <p className="mt-0.5 text-sm text-text-secondary">Real-time. Advance orders left → right.</p>
      </header>
      <OrderQueue tenantId={tenantId} initialOrders={orders ?? []} />
    </div>
  )
}
