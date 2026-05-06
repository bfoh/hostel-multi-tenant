import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { MenuEditor } from '@/components/food/menu-editor'

export const metadata: Metadata = { title: 'Menu · Food' }

export default async function FoodMenuPage() {
  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  if (!tenantId) redirect('/login')

  const admin = createAdminClient() as any
  const [{ data: cats }, { data: items }] = await Promise.all([
    admin.from('menu_categories')
      .select('id, name, sort_order, is_active')
      .eq('tenant_id', tenantId).order('sort_order'),
    admin.from('menu_items')
      .select('id, category_id, name, description, price_pesewas, photo_url, is_available, is_sold_out, publish_date, sort_order')
      .eq('tenant_id', tenantId).order('sort_order').limit(500),
  ])

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold text-text-primary">Food menu</h1>
        <p className="mt-0.5 text-sm text-text-secondary">Manage categories, items, photos, daily availability.</p>
      </header>
      <MenuEditor initialCategories={cats ?? []} initialItems={items ?? []} />
    </div>
  )
}
