import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { PublicOrderTracker } from '@/components/public/food/public-order-tracker'

export const metadata: Metadata = { title: 'Track order · Food' }

export default async function PublicTrackerPage({
  params, searchParams,
}: {
  params:       Promise<{ slug: string; id: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { slug, id } = await params
  const { token }    = await searchParams
  if (!token) notFound()

  const admin = createAdminClient() as any
  const { data: tenant } = await admin
    .from('tenants')
    .select('id, name, primary_color')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()
  if (!tenant) notFound()

  const { data: order } = await admin
    .from('food_orders')
    .select('*, food_order_items(*)')
    .eq('id', id)
    .eq('tenant_id', tenant.id)
    .eq('tracking_token', token)
    .maybeSingle()
  if (!order) notFound()

  const color = tenant.primary_color ?? '#2563EB'

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 pb-12 sm:px-6 space-y-3">
      <Link href={`/order/${slug}`} className="inline-flex items-center gap-1 text-xs text-slate-500">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to menu
      </Link>
      <PublicOrderTracker initial={order} slug={slug} token={token} color={color} />
    </div>
  )
}
