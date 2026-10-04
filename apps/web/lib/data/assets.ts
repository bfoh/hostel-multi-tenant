import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { applySearchTerms, DEFAULT_LIST_PAGE_SIZE, normalisePage } from '@/lib/data/listing'

export type AssetStatus    = 'active' | 'maintenance' | 'disposed' | 'lost'
export type AssetCondition = 'excellent' | 'good' | 'fair' | 'poor'

export interface Asset {
  id:             string
  name:           string
  category:       string
  description:    string | null
  brand:          string | null
  model:          string | null
  serial_number:  string | null
  qr_code:        string
  room_id:        string | null
  location_note:  string | null
  purchase_date:  string | null
  purchase_price: number | null
  supplier:       string | null
  warranty_expiry:string | null
  status:         AssetStatus
  condition:      AssetCondition
  notes:          string | null
  created_at:     string
  updated_at:     string
  room?: { room_number: string; block: string | null } | null
}

export async function getAssets(filters?: {
  status?:   string
  category?: string
  room_id?:  string
  search?:   string
}): Promise<Asset[]> {
  return (await getAssetsPage(filters)).rows
}

export async function getAssetsPage(filters?: {
  status?: string
  category?: string
  room_id?: string
  search?: string
  page?: number
}) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return { rows: [] as Asset[], total: 0, page: 1, pageSize: DEFAULT_LIST_PAGE_SIZE }

  const supabase = createAdminClient()

  let q = supabase
    .from('assets')
    .select(`
      id, name, category, description, brand, model, serial_number,
      qr_code, room_id, location_note, purchase_date, purchase_price,
      supplier, warranty_expiry, status, condition, notes, created_at, updated_at,
      room:rooms(room_number, block)
    `, { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('name', { ascending: true })

  if (filters?.status   && filters.status !== 'all')   q = q.eq('status',   filters.status)
  if (filters?.category && filters.category !== 'all') q = q.eq('category', filters.category)
  if (filters?.room_id)  q = q.eq('room_id', filters.room_id)
  q = applySearchTerms(
    q,
    ['name', 'category', 'description', 'brand', 'model', 'serial_number', 'qr_code', 'location_note', 'supplier'],
    filters?.search,
  )

  const page = normalisePage(filters?.page)
  const offset = (page - 1) * DEFAULT_LIST_PAGE_SIZE
  const { data, count } = await q.range(offset, offset + DEFAULT_LIST_PAGE_SIZE - 1)
  const rows = ((data ?? []) as any[]).map((a) => ({
    ...a,
    room: Array.isArray(a.room) ? (a.room[0] ?? null) : (a.room ?? null),
  })) as Asset[]
  return { rows, total: count ?? 0, page, pageSize: DEFAULT_LIST_PAGE_SIZE }
}

export async function getAssetByQr(qrCode: string): Promise<Asset | null> {
  const tenantId = await getServerTenantId()
  if (!tenantId) return null

  const supabase = createAdminClient()
  const { data } = await (supabase.from('assets') as any)
    .select(`
      id, name, category, description, brand, model, serial_number,
      qr_code, room_id, location_note, purchase_date, purchase_price,
      supplier, warranty_expiry, status, condition, notes, created_at, updated_at,
      room:rooms(room_number, block)
    `)
    .eq('tenant_id', tenantId)
    .eq('qr_code', qrCode)
    .maybeSingle()

  if (!data) return null
  return {
    ...(data as any),
    room: Array.isArray((data as any).room) ? ((data as any).room[0] ?? null) : ((data as any).room ?? null),
  } as Asset
}

export async function getAssetSummary() {
  const tenantId = await getServerTenantId()
  if (!tenantId) return { total: 0, active: 0, maintenance: 0, disposed: 0, lost: 0, totalValue: 0, byCategory: {} }

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('assets')
    .select('status, condition, purchase_price, category')
    .eq('tenant_id', tenantId)

  const rows = data ?? []

  const byStatus: Record<string, number> = {}
  const byCategory: Record<string, number> = {}

  for (const r of rows) {
    byStatus[r.status]     = (byStatus[r.status]     ?? 0) + 1
    byCategory[r.category] = (byCategory[r.category] ?? 0) + 1
  }

  const totalValue = rows.reduce((s, r) => s + (r.purchase_price ?? 0), 0)

  return {
    total:      rows.length,
    active:     byStatus['active']      ?? 0,
    maintenance:byStatus['maintenance'] ?? 0,
    disposed:   byStatus['disposed']    ?? 0,
    lost:       byStatus['lost']        ?? 0,
    totalValue,
    byCategory,
  }
}

/** Generate a short unique QR code: ASSET-XXXXXX */
export function generateQrCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'ASSET-'
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}
