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
      <div className="flex flex-col items-center rounded-2xl border border-slate-200/70 bg-white px-6 py-12 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_28px_-18px_rgba(16,24,40,0.20)]">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-100">
          <Utensils className="h-7 w-7 text-slate-300" />
        </span>
        <p className="mt-3 text-[14px] font-semibold text-slate-700">Food ordering not enabled</p>
        <p className="mt-0.5 text-[12.5px] text-slate-400">Contact reception if this looks wrong.</p>
      </div>
    )
  }

  const { categories, items } = await getTodaysMenu(session.tenantId)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span
          className="flex h-11 w-11 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${session.tenantColor}14` }}
        >
          <Utensils className="h-5 w-5" style={{ color: session.tenantColor }} strokeWidth={2.1} />
        </span>
        <div>
          <h1 className="text-[18px] font-bold tracking-tight text-slate-900">Today&apos;s menu</h1>
          <p className="text-[12px] text-slate-500">Order for pickup — pay online or on collection</p>
        </div>
      </div>
      <MenuGrid categories={categories} items={items} color={session.tenantColor} />
    </div>
  )
}
