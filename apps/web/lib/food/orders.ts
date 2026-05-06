import { createAdminClient } from '@/lib/supabase/admin'
import { getCart, clearCart, type CartLine } from './cart'

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  // no 0/O/1/I

export function generateOrderRef(): string {
  let s = ''
  for (let i = 0; i < 4; i++) s += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)]
  return `F-${s}`
}

interface PlaceArgs {
  tenantId:       string
  occupantId:     string
  bookingId:      string | null
  paymentMethod:  'online' | 'cash_on_pickup'
  notes:          string | null
  channel?:       'resident' | 'walk_in' | 'online'   // defaults to 'resident'
  tableLabel?:    string | null
  trackingToken?: string | null
  /**
   * Optional cart override. Resident path leaves this undefined and the
   * server-persisted cart in `food_carts` is loaded. Guest channels pass
   * lines directly from the client's localStorage cart and skip the
   * server-cart fetch + clear.
   */
  cartLines?:     CartLine[]
}

export async function placeOrder(args: PlaceArgs) {
  const admin = createAdminClient() as any
  const cart  = args.cartLines ?? await getCart(args.occupantId)
  if (cart.length === 0) return { error: 'Cart is empty' as const }

  const ids = cart.map(c => c.menu_item_id)
  const { data: items } = await admin
    .from('menu_items')
    .select('id, name, price_pesewas, is_available, is_sold_out, publish_date')
    .in('id', ids)
    .eq('tenant_id', args.tenantId)
  const today = new Date().toISOString().slice(0, 10)
  const byId  = new Map<string, any>(((items ?? []) as any[]).map((i: any) => [i.id, i]))

  const failed: string[] = []
  for (const line of cart) {
    const it = byId.get(line.menu_item_id)
    if (!it || !it.is_available || it.is_sold_out) { failed.push(line.menu_item_id); continue }
    if (it.publish_date && it.publish_date !== today) failed.push(line.menu_item_id)
  }
  if (failed.length > 0) return { error: 'Some items unavailable', failed }

  let total = 0
  const rows = cart.map((line: CartLine) => {
    const it       = byId.get(line.menu_item_id)
    const subtotal = it.price_pesewas * line.quantity
    total += subtotal
    return {
      menu_item_id:       it.id,
      name_snapshot:      it.name,
      quantity:           line.quantity,
      unit_price_pesewas: it.price_pesewas,
      subtotal_pesewas:   subtotal,
    }
  })
  if (total <= 0) return { error: 'Invalid total' as const }

  let order: any = null
  for (let attempt = 0; attempt < 5; attempt++) {
    const ref = generateOrderRef()
    const { data, error } = await admin
      .from('food_orders')
      .insert({
        tenant_id:      args.tenantId,
        occupant_id:    args.occupantId,
        booking_id:     args.bookingId,
        order_ref:      ref,
        status:         'placed',
        total_pesewas:  total,
        payment_method: args.paymentMethod,
        notes:          args.notes,
        customer_kind:  args.channel       ?? 'resident',
        table_label:    args.tableLabel    ?? null,
        tracking_token: args.trackingToken ?? null,
      })
      .select('id, order_ref, total_pesewas, payment_method, customer_kind, tracking_token')
      .single()
    if (!error) { order = data; break }
    if ((error as any).code !== '23505') return { error: error.message }
  }
  if (!order) return { error: 'Could not generate unique ref' as const }

  const linkedRows = rows.map(r => ({ ...r, order_id: order.id }))
  const { error: itemErr } = await admin.from('food_order_items').insert(linkedRows)
  if (itemErr) {
    await admin.from('food_orders').delete().eq('id', order.id)
    return { error: itemErr.message }
  }

  // Only clear the server-persisted cart for the resident channel.
  // Guests don't have a server cart — their cart was passed via cartLines.
  if (!args.cartLines) {
    await clearCart(args.occupantId)
  }
  return { ok: true as const, order }
}

const TRANSITIONS: Record<string, string[]> = {
  placed:     ['preparing', 'cancelled'],
  preparing:  ['ready', 'cancelled'],
  ready:      ['picked_up', 'cancelled'],
  picked_up:  [],
  cancelled:  [],
}

export async function advanceStatus(orderId: string, tenantId: string, next: string, reason?: string) {
  const admin = createAdminClient() as any
  const { data: order } = await admin
    .from('food_orders')
    .select('id, status, occupant_id, payment_method, paid_at, total_pesewas, paystack_reference, order_ref')
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!order) return { error: 'Not found' as const }

  const allowed = TRANSITIONS[order.status] ?? []
  if (!allowed.includes(next)) return { error: `Cannot transition ${order.status} → ${next}` }

  const stamp = new Date().toISOString()
  const update: any = { status: next }
  if (next === 'preparing') update.preparing_at  = stamp
  if (next === 'ready')     update.ready_at      = stamp
  if (next === 'picked_up') update.picked_up_at  = stamp
  if (next === 'cancelled') {
    update.cancelled_at      = stamp
    update.cancelled_reason  = reason ?? null
  }

  const { error } = await admin.from('food_orders').update(update).eq('id', orderId)
  if (error) return { error: error.message }
  return { ok: true as const, prev: order.status, order }
}
