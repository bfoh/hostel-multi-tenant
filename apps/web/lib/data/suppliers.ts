import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'

export interface Supplier {
  id:                          string
  name:                        string
  contact_name:                string | null
  phone:                       string | null
  email:                       string | null
  address:                     string | null
  tin:                         string | null
  payment_terms_days:          number
  default_expense_account_id:  string | null
  default_currency:            string
  notes:                       string | null
  is_active:                   boolean
  created_at:                  string
  updated_at:                  string
  /** Computed: sum of open bill balances (pesewas) */
  openBalance?:                number
  /** Computed: count of open bills */
  openCount?:                  number
}

export async function getSuppliers(includeInactive = false): Promise<Supplier[]> {
  const tenantId = await getServerTenantId()
  if (!tenantId) return []

  const supabase = createAdminClient()
  let q = (supabase as any)
    .from('suppliers')
    .select(`
      id, name, contact_name, phone, email, address, tin,
      payment_terms_days, default_expense_account_id, default_currency,
      notes, is_active, created_at, updated_at
    `)
    .eq('tenant_id', tenantId)
    .order('name')
    .limit(500)

  if (!includeInactive) q = q.eq('is_active', true)

  const { data: suppliers } = await q

  // Aggregate open balances per supplier_id
  const { data: bills } = await (supabase as any)
    .from('supplier_bills')
    .select('supplier_id, amount, paid_amount, status')
    .eq('tenant_id', tenantId)
    .in('status', ['approved', 'partial'])
    .not('supplier_id', 'is', null)

  const balances = new Map<string, { open: number; count: number }>()
  for (const b of (bills ?? []) as any[]) {
    if (!b.supplier_id) continue
    const cur = balances.get(b.supplier_id) ?? { open: 0, count: 0 }
    cur.open  += Math.max(0, Number(b.amount) - Number(b.paid_amount))
    cur.count += 1
    balances.set(b.supplier_id, cur)
  }

  return ((suppliers ?? []) as any[]).map((s) => ({
    ...s,
    openBalance: balances.get(s.id)?.open ?? 0,
    openCount:   balances.get(s.id)?.count ?? 0,
  })) as Supplier[]
}

export async function getSupplierById(id: string): Promise<Supplier | null> {
  const tenantId = await getServerTenantId()
  if (!tenantId) return null

  const supabase = createAdminClient()
  const { data } = await (supabase as any)
    .from('suppliers')
    .select(`
      id, name, contact_name, phone, email, address, tin,
      payment_terms_days, default_expense_account_id, default_currency,
      notes, is_active, created_at, updated_at
    `)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  return data as Supplier | null
}
