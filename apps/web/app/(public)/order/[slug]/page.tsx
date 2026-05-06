import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Utensils } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTodaysMenu } from '@/lib/food/menu'
import { PublicMenuGrid } from '@/components/public/food/public-menu-grid'

export const metadata: Metadata = { title: "Today's menu" }

export default async function PublicMenuPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const admin = createAdminClient() as any

  const { data: tenant } = await admin
    .from('tenants')
    .select('id, name, primary_color, logo_url, food_orders_enabled, tagline')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()
  if (!tenant) notFound()

  const color = tenant.primary_color ?? '#2563EB'

  if (!tenant.food_orders_enabled) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <header className="rounded-2xl p-4 text-white" style={{ backgroundColor: color }}>
          {tenant.logo_url
            ? <img src={tenant.logo_url} alt={tenant.name} className="h-8" />
            : <p className="font-bold">{tenant.name}</p>}
        </header>
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <Utensils className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-medium text-slate-500">Online ordering not available</p>
          <p className="mt-1 text-xs text-slate-400">{tenant.name} has not enabled food ordering.</p>
        </div>
      </div>
    )
  }

  const { categories, items } = await getTodaysMenu(tenant.id)

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 pb-24 sm:px-6">
      <header className="mb-4 flex items-center gap-3 rounded-2xl p-4 text-white" style={{ backgroundColor: color }}>
        {tenant.logo_url
          ? <img src={tenant.logo_url} alt="" className="h-8 w-auto bg-white/90 rounded p-0.5" />
          : null}
        <div>
          <p className="font-bold">{tenant.name}</p>
          <p className="text-[11px] opacity-80">Today's menu — order for pickup</p>
        </div>
      </header>
      <PublicMenuGrid slug={slug} categories={categories} items={items} color={color} />
    </div>
  )
}
