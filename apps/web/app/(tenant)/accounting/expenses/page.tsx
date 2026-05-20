import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { ExpensesClient } from '@/components/accounting/expenses-client'

export const metadata: Metadata = { title: 'Expenses' }

export default async function ExpensesPage() {
  const tenantId = await getServerTenantId()
  const supabase = createAdminClient()

  const { data: expenses } = tenantId
    ? await supabase
        .from('expenses')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('expense_date', { ascending: false })
        .limit(200)
    : { data: [] as any[] }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Expenses</h1>
        <p className="mt-1 text-sm text-text-secondary">Track operational costs by category — auto-posts to journal on save</p>
      </div>
      <ExpensesClient initialExpenses={(expenses ?? []) as any} />
    </div>
  )
}
