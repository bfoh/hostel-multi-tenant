import { createAdminClient } from '@/lib/supabase/admin'

export interface RevenuePoint {
  id:          string
  name:       string
  type:       string
  description: string | null
  is_active:  boolean
  created_at: string
  todaySales: number   // pesewas
  todayCount: number
  monthSales: number   // pesewas
}

export interface RevenuePointItem {
  id:               string
  revenue_point_id: string
  name:             string
  category:         string | null
  unit_price:       number
  unit:             string
  is_active:        boolean
  sort_order:       number
}

/**
 * List all revenue points for a tenant, with today's and MTD sales totals.
 */
export async function getRevenuePoints(tenantId: string): Promise<RevenuePoint[]> {
  const supabase = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const { data: points } = await (supabase as any)
    .from('revenue_points')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name')

  if (!points || points.length === 0) return []

  // Fetch all sales for today + this month in one query
  const { data: allSales } = await (supabase as any)
    .from('revenue_point_sales')
    .select('revenue_point_id, total_amount, sold_at')
    .eq('tenant_id', tenantId)
    .gte('sold_at', monthStart)

  const todayMap  = new Map<string, { total: number; count: number }>()
  const monthMap  = new Map<string, number>()

  for (const s of allSales ?? []) {
    const rpId = s.revenue_point_id
    const isToday = s.sold_at?.startsWith(today)

    // Month totals
    monthMap.set(rpId, (monthMap.get(rpId) ?? 0) + s.total_amount)

    // Today totals
    if (isToday) {
      const entry = todayMap.get(rpId) ?? { total: 0, count: 0 }
      entry.total += s.total_amount
      entry.count += 1
      todayMap.set(rpId, entry)
    }
  }

  return points.map((p: any) => ({
    id:          p.id,
    name:        p.name,
    type:        p.type,
    description: p.description,
    is_active:   p.is_active,
    created_at:  p.created_at,
    todaySales:  todayMap.get(p.id)?.total ?? 0,
    todayCount:  todayMap.get(p.id)?.count ?? 0,
    monthSales:  monthMap.get(p.id) ?? 0,
  }))
}

/**
 * Get items for a specific revenue point.
 */
export async function getRevenuePointItems(
  tenantId: string,
  revenuePointId: string,
): Promise<RevenuePointItem[]> {
  const supabase = createAdminClient()

  const { data } = await (supabase as any)
    .from('revenue_point_items')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('revenue_point_id', revenuePointId)
    .eq('is_active', true)
    .order('sort_order')
    .order('name')

  return (data ?? []) as RevenuePointItem[]
}

/**
 * Get recent sales for a specific revenue point.
 */
export async function getRevenuePointSales(
  tenantId: string,
  revenuePointId: string,
  limit = 20,
): Promise<any[]> {
  const supabase = createAdminClient()

  const { data } = await (supabase as any)
    .from('revenue_point_sales')
    .select('id, description, quantity, total_amount, payment_method, sold_at')
    .eq('tenant_id', tenantId)
    .eq('revenue_point_id', revenuePointId)
    .order('sold_at', { ascending: false })
    .limit(limit)

  return (data ?? []).map((s: any) => ({
    ...s,
    itemName: s.description,
  }))
}

/**
 * Get aggregated auxiliary (non-room) revenue for dashboard.
 */
export async function getAuxiliaryRevenueSummary(tenantId: string) {
  const supabase = createAdminClient()
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const lastMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString()
  const lastMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString()

  const [thisMonthRes, lastMonthRes] = await Promise.all([
    (supabase as any)
      .from('revenue_point_sales')
      .select('total_amount')
      .eq('tenant_id', tenantId)
      .gte('sold_at', monthStart),
    (supabase as any)
      .from('revenue_point_sales')
      .select('total_amount')
      .eq('tenant_id', tenantId)
      .gte('sold_at', lastMonthStart)
      .lte('sold_at', lastMonthEnd),
  ])

  const thisMonth = (thisMonthRes.data ?? []).reduce((s: number, r: any) => s + r.total_amount, 0)
  const lastMonth = (lastMonthRes.data ?? []).reduce((s: number, r: any) => s + r.total_amount, 0)
  const change = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0

  return { thisMonth, lastMonth, change }
}

/**
 * Get revenue breakdown by revenue point type for charts.
 */
export async function getRevenueBreakdownByPoint(tenantId: string) {
  const supabase = createAdminClient()
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const { data } = await (supabase as any)
    .from('revenue_point_sales')
    .select('revenue_point_id, total_amount')
    .eq('tenant_id', tenantId)
    .gte('sold_at', monthStart)

  const { data: points } = await (supabase as any)
    .from('revenue_points')
    .select('id, name, type')
    .eq('tenant_id', tenantId)

  const pointMap = new Map((points ?? []).map((p: any) => [p.id, p]))
  const totals = new Map<string, { name: string; type: string; amount: number }>()

  for (const s of (data ?? []) as any[]) {
    const point = pointMap.get(s.revenue_point_id)
    if (!point) continue
    const entry = totals.get(s.revenue_point_id) ?? { name: (point as any).name, type: (point as any).type, amount: 0 }
    entry.amount += s.total_amount
    totals.set(s.revenue_point_id, entry)
  }

  return Array.from(totals.values()).sort((a, b) => b.amount - a.amount)
}
