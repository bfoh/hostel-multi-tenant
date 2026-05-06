import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTodaysMenu } from '@/lib/food/menu'
import { GuestCheckoutForm } from '@/components/public/food/guest-checkout-form'

export const metadata: Metadata = { title: 'Checkout · Food' }

export default async function PublicCartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const admin = createAdminClient() as any

  const { data: tenant } = await admin
    .from('tenants')
    .select('id, name, primary_color, food_orders_enabled, paystack_subaccount_code')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()
  if (!tenant || !tenant.food_orders_enabled) notFound()

  const { items } = await getTodaysMenu(tenant.id)
  const color = tenant.primary_color ?? '#2563EB'
  const onlineEnabled = !!tenant.paystack_subaccount_code

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 pb-12 sm:px-6 space-y-3">
      <Link href={`/order/${slug}`} className="inline-flex items-center gap-1 text-xs text-slate-500">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to menu
      </Link>
      <h1 className="text-xl font-bold text-slate-900">Checkout</h1>
      <GuestCheckoutForm
        slug={slug}
        color={color}
        onlineEnabled={onlineEnabled}
        items={items.map(it => ({
          id: it.id,
          name: it.name,
          price_pesewas: it.price_pesewas,
          photo_url: it.photo_url,
          is_sold_out: it.is_sold_out,
        }))}
      />
    </div>
  )
}
