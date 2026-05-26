import { createTenantAdminClient } from '@/lib/supabase/tenant-admin'

export interface CartLine { menu_item_id: string; quantity: number }

export async function getCart(occupantId: string, tenantId: string): Promise<CartLine[]> {
  const admin = createTenantAdminClient(tenantId) as any
  const { data } = await admin
    .from('food_carts')
    .select('items')
    .eq('occupant_id', occupantId)
    .maybeSingle()
  if (!data) return []
  return (data.items ?? []) as CartLine[]
}

export async function setCart(occupantId: string, tenantId: string, lines: CartLine[]) {
  const sane = lines
    .filter(l => l.menu_item_id && Number.isFinite(l.quantity) && l.quantity > 0)
    .map(l => ({
      menu_item_id: String(l.menu_item_id),
      quantity:     Math.max(1, Math.min(10, Math.floor(l.quantity))),
    }))

  const admin = createTenantAdminClient(tenantId) as any
  const { error } = await admin
    .from('food_carts')
    .upsert({
      occupant_id: occupantId,
      tenant_id:   tenantId,
      items:       sane,
      updated_at:  new Date().toISOString(),
    })
  if (error) return { error: error.message }
  return { ok: true as const, items: sane }
}

export async function clearCart(occupantId: string, tenantId: string) {
  const admin = createTenantAdminClient(tenantId) as any
  await admin.from('food_carts').delete().eq('occupant_id', occupantId)
}
