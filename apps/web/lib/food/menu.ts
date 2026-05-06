import { createAdminClient } from '@/lib/supabase/admin'

export interface MenuCategory {
  id: string
  name: string
  sort_order: number
}

export interface MenuItem {
  id:            string
  category_id:   string | null
  name:          string
  description:   string | null
  price_pesewas: number
  photo_url:     string | null
  is_sold_out:   boolean
  sort_order:    number
}

export async function getTodaysMenu(tenantId: string): Promise<{ categories: MenuCategory[]; items: MenuItem[] }> {
  const admin = createAdminClient() as any
  const { data: cats } = await admin
    .from('menu_categories')
    .select('id, name, sort_order')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  const today = new Date().toISOString().slice(0, 10)
  const { data: items } = await admin
    .from('menu_items')
    .select('id, category_id, name, description, price_pesewas, photo_url, is_sold_out, sort_order')
    .eq('tenant_id', tenantId)
    .eq('is_available', true)
    .or(`publish_date.is.null,publish_date.eq.${today}`)
    .order('sort_order', { ascending: true })
    .limit(500)

  return { categories: (cats ?? []) as MenuCategory[], items: (items ?? []) as MenuItem[] }
}

export async function getMenuItem(id: string, tenantId: string) {
  const admin = createAdminClient() as any
  const { data } = await admin
    .from('menu_items')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  return data
}
