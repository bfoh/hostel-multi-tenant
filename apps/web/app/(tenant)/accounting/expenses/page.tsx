import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { ExpensesClient } from '@/components/accounting/expenses-client'
import { getLatestFxRates } from '@/lib/data/fx'

export const metadata: Metadata = { title: 'Expenses' }

export default async function ExpensesPage() {
  const tenantId = await getServerTenantId()
  const supabase = createAdminClient()

  const [{ data: expenses }, fxRates] = await Promise.all([
    tenantId
      ? supabase
          .from('expenses')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('expense_date', { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [] as any[] }),
    getLatestFxRates(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Expenses</h1>
        <p className="mt-1 text-sm text-text-secondary">Track operational costs by category — auto-posts to journal on save</p>
      </div>
      <ExpensesClient
        initialExpenses={(expenses ?? []) as any}
        fxRates={fxRates.map((r) => ({ code: r.currency_code, rate: r.rate_to_base, asOf: r.as_of_date }))}
      />
    </div>
  )
}
