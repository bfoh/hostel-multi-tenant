import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { computeMonthlyDepreciation, type DepreciationMethod } from '@/lib/data/depreciation'

export interface ScheduleLine {
  monthIndex:    number   // 0..N
  monthLabel:    string   // 'Jan 26'
  depreciation:  number   // pesewas
  cumulative:    number   // pesewas
  netBookValue:  number   // pesewas
}

export interface AssetSchedule {
  id:              string
  name:            string
  category:        string
  purchase_price:  number
  salvage_value:   number
  method:          DepreciationMethod
  declining_factor:number
  useful_life_months: number
  accumulatedToDate: number
  netBookToDate:   number
  monthsRemaining: number
  schedule:        ScheduleLine[]  // projection forward up to monthsRemaining (capped at maxMonths)
  fullyDepreciatedAt: string | null
}

export interface RegisterRow {
  id:               string
  name:             string
  category:         string
  qr_code:          string
  room:             { id: string; room_number: string; block: string | null } | null
  location_note:    string | null
  purchase_date:    string | null
  purchase_price:   number | null
  salvage_value:    number
  method:           DepreciationMethod
  useful_life_months: number | null
  accumulated_depreciation: number
  netBookValue:     number
  status:           string
  condition:        string
  warranty_expiry:  string | null
}

export async function getDepreciationSchedule(maxMonthsPerAsset = 24): Promise<AssetSchedule[] | null> {
  const tenantId = await getServerTenantId()
  if (!tenantId) return null

  const supabase = createAdminClient()
  const { data } = await (supabase as any)
    .from('assets')
    .select(`
      id, name, category,
      purchase_price, salvage_value,
      useful_life_months, depreciation_method, declining_factor,
      accumulated_depreciation
    `)
    .eq('tenant_id', tenantId)
    .neq('status', 'disposed')
    .not('purchase_price', 'is', null)
    .not('useful_life_months', 'is', null)
    .order('name')

  const today = new Date()
  const out: AssetSchedule[] = []

  for (const a of (data ?? []) as any[]) {
    const cost    = Number(a.purchase_price)
    const salvage = Number(a.salvage_value ?? 0)
    const life    = Number(a.useful_life_months)
    const method: DepreciationMethod = a.depreciation_method ?? 'straight_line'
    const factor  = Number(a.declining_factor ?? 2.0)
    let   accum   = Number(a.accumulated_depreciation ?? 0)
    const nbv     = Math.max(0, cost - accum)

    if (nbv <= salvage) {
      out.push({
        id: a.id, name: a.name, category: a.category,
        purchase_price: cost, salvage_value: salvage,
        method, declining_factor: factor, useful_life_months: life,
        accumulatedToDate: accum, netBookToDate: nbv, monthsRemaining: 0,
        schedule: [], fullyDepreciatedAt: null,
      })
      continue
    }

    const schedule: ScheduleLine[] = []
    const startDate = new Date(today.getFullYear(), today.getMonth(), 1)
    let monthsRemaining = 0
    let fullyAt: string | null = null

    for (let i = 0; i < life * 2; i++) {  // hard upper bound
      const periodDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1)
      const periodLabel = periodDate.toLocaleDateString('en-GH', { month: 'short', year: '2-digit' })

      const monthly = computeMonthlyDepreciation({
        purchase_price:           cost,
        salvage_value:            salvage,
        useful_life_months:       life,
        depreciation_method:      method,
        declining_factor:         factor,
        accumulated_depreciation: accum,
      })
      const remaining = Math.max(0, cost - salvage - accum)
      const amount    = Math.min(monthly, remaining)

      if (amount <= 0) {
        fullyAt = periodDate.toISOString().slice(0, 10)
        break
      }

      accum += amount
      monthsRemaining += 1

      if (schedule.length < maxMonthsPerAsset) {
        schedule.push({
          monthIndex:   i,
          monthLabel:   periodLabel,
          depreciation: amount,
          cumulative:   accum,
          netBookValue: Math.max(0, cost - accum),
        })
      }

      // Stop loop tracking after we hit salvage
      if (accum >= cost - salvage) {
        fullyAt = periodDate.toISOString().slice(0, 10)
        break
      }
    }

    out.push({
      id: a.id, name: a.name, category: a.category,
      purchase_price: cost, salvage_value: salvage,
      method, declining_factor: factor, useful_life_months: life,
      accumulatedToDate: Number(a.accumulated_depreciation ?? 0),
      netBookToDate: nbv,
      monthsRemaining, schedule, fullyDepreciatedAt: fullyAt,
    })
  }

  return out
}

export async function getAssetRegister(): Promise<RegisterRow[] | null> {
  const tenantId = await getServerTenantId()
  if (!tenantId) return null

  const supabase = createAdminClient()
  const { data } = await (supabase as any)
    .from('assets')
    .select(`
      id, name, category, qr_code, status, condition,
      location_note, purchase_date, purchase_price,
      salvage_value, useful_life_months, depreciation_method,
      accumulated_depreciation, warranty_expiry,
      room:rooms(id, room_number, block)
    `)
    .eq('tenant_id', tenantId)
    .order('name')

  return ((data ?? []) as any[]).map((a) => {
    const cost = a.purchase_price ?? 0
    const accum = a.accumulated_depreciation ?? 0
    const room = Array.isArray(a.room) ? a.room[0] : a.room
    return {
      id:                       a.id,
      name:                     a.name,
      category:                 a.category,
      qr_code:                  a.qr_code,
      room:                     room ? { id: room.id, room_number: room.room_number, block: room.block } : null,
      location_note:            a.location_note,
      purchase_date:            a.purchase_date,
      purchase_price:           a.purchase_price,
      salvage_value:            Number(a.salvage_value ?? 0),
      method:                   (a.depreciation_method ?? 'straight_line') as DepreciationMethod,
      useful_life_months:       a.useful_life_months,
      accumulated_depreciation: accum,
      netBookValue:             Math.max(0, cost - accum),
      status:                   a.status,
      condition:                a.condition,
      warranty_expiry:          a.warranty_expiry,
    }
  }) as RegisterRow[]
}
