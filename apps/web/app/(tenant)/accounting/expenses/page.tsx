import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { ExpensesClient } from '@/components/accounting/expenses-client'
import { getLatestFxRates } from '@/lib/data/fx'

export const metadata: Metadata = { title: 'Expenses' }

export default async function ExpensesPage() {
  const tenantId = await getServerTenantId()
  const supabase = createAdminClient()

  const [expenses, fxRates] = await Promise.all([
    tenantId ? getAllExpenses(supabase, tenantId) : Promise.resolve([] as any[]),
    getLatestFxRates(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Expenses</h1>
        <p className="mt-1 text-sm text-text-secondary">Track operational costs by category — auto-posts to journal on save</p>
      </div>
      <ExpensesClient
        initialExpenses={expenses as any}
        fxRates={fxRates.map((r) => ({ code: r.currency_code, rate: r.rate_to_base, asOf: r.as_of_date }))}
      />
    </div>
  )
}

async function getAllExpenses(supabase: ReturnType<typeof createAdminClient>, tenantId: string) {
  const rows: any[] = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('expense_date', { ascending: false })
      .range(from, from + pageSize - 1)
    rows.push(...(data ?? []))
    if ((data ?? []).length < pageSize) break
  }
  return rows
}
