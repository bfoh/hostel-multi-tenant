import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getOccupantSession } from '@/lib/auth/occupant-session'
import { getCart, setCart } from '@/lib/food/cart'
import { createTenantAdminClient } from '@/lib/supabase/tenant-admin'

const setSchema = z.object({
  items: z.array(z.object({
    menu_item_id: z.string().uuid(),
    quantity:     z.number().int().min(1).max(10),
  })).max(50),
})

export async function GET() {
  const session = await getOccupantSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cart = await getCart(session.occupantId, session.tenantId)
  if (cart.length === 0) return NextResponse.json({ items: [], total_pesewas: 0 })

  const admin = createTenantAdminClient(session.tenantId) as any
  const { data: items } = await admin
    .from('menu_items')
    .select('id, name, price_pesewas, photo_url, is_available, is_sold_out, publish_date')
    .in('id', cart.map(c => c.menu_item_id))
    .eq('tenant_id', session.tenantId)

  const today = new Date().toISOString().slice(0, 10)
  const byId = new Map<string, any>(((items ?? []) as any[]).map(i => [i.id, i]))
  const lines = cart.map(c => {
    const it = byId.get(c.menu_item_id)
    if (!it) return { ...c, name: 'Unavailable', price_pesewas: 0, subtotal_pesewas: 0, available: false }
    const available = it.is_available && !it.is_sold_out && (!it.publish_date || it.publish_date === today)
    return {
      menu_item_id:     c.menu_item_id,
      quantity:         c.quantity,
      name:             it.name,
      photo_url:        it.photo_url,
      price_pesewas:    it.price_pesewas,
      subtotal_pesewas: it.price_pesewas * c.quantity,
      available,
    }
  })
  const total = lines.filter(l => l.available).reduce((s, l) => s + l.subtotal_pesewas, 0)
  return NextResponse.json({ items: lines, total_pesewas: total })
}

export async function POST(req: NextRequest) {
  const session = await getOccupantSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const json   = await req.json().catch(() => null)
  const parsed = setSchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 422 })

  const result = await setCart(session.occupantId, session.tenantId, parsed.data.items)
  if ('error' in result) return NextResponse.json(result, { status: 500 })
  return NextResponse.json(result)
}
