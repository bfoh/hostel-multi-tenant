import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'

export type TaxFilingKind   = 'vat_levies' | 'paye' | 'ssnit' | 'corporate'
export type TaxFilingStatus = 'pending' | 'filed' | 'overdue'

export interface TaxFiling {
  id:           string
  kind:         TaxFilingKind
  period_year:  number
  period_month: number | null
  due_date:     string
  filed_at:     string | null
  amount_due:   number | null
  reference:    string | null
  proof_url:    string | null
  notes:        string | null
  status:       TaxFilingStatus
  created_at:   string
}

export async function getTaxFilings(limit = 100): Promise<TaxFiling[]> {
  const tenantId = await getServerTenantId()
  if (!tenantId) return []

  const supabase = createAdminClient()
  const { data } = await (supabase as any)
    .from('tax_filings')
    .select('id, kind, period_year, period_month, due_date, filed_at, amount_due, reference, proof_url, notes, status, created_at')
    .eq('tenant_id', tenantId)
    .order('due_date', { ascending: false })
    .limit(limit)
  return (data ?? []) as TaxFiling[]
}

export async function getFilingFor(
  kind: TaxFilingKind,
  year: number,
  month: number | null,
): Promise<TaxFiling | null> {
  const tenantId = await getServerTenantId()
  if (!tenantId) return null

  const supabase = createAdminClient()
  let q = (supabase as any)
    .from('tax_filings')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('kind', kind)
    .eq('period_year', year)

  q = month === null ? q.is('period_month', null) : q.eq('period_month', month)

  const { data } = await q.maybeSingle()
  return data as TaxFiling | null
}
