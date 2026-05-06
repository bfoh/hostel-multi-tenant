import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Utensils } from 'lucide-react'
import { getOccupantSession } from '@/lib/auth/occupant-session'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTodaysMenu } from '@/lib/food/menu'
import { MenuGrid } from '@/components/occupant-portal/food/menu-grid'

export const metadata: Metadata = { title: 'Food · My Portal' }

export default async function OccupantFoodPage() {
  const session = await getOccupantSession()
  if (!session) redirect('/login')

  const admin = createAdminClient() as any
  const { data: tenant } = await admin
    .from('tenants')
    .select('food_orders_enabled')
    .eq('id', session.tenantId)
    .maybeSingle()

  if (!tenant?.food_orders_enabled) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
        <Utensils className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-2 text-sm font-medium text-slate-500">Food ordering not enabled</p>
        <p className="mt-1 text-xs text-slate-400">Contact reception if this looks wrong.</p>
      </div>
    )
  }

  const { categories, items } = await getTodaysMenu(session.tenantId)

  return (
    <div className="space-y-4">
      <header className="px-1">
        <h1 className="text-xl font-bold text-slate-900">Today's menu</h1>
        <p className="mt-0.5 text-sm text-slate-500">Order food for pickup. Pay online or pay when you collect.</p>
      </header>
      <MenuGrid categories={categories} items={items} color={session.tenantColor} />
    </div>
  )
}
