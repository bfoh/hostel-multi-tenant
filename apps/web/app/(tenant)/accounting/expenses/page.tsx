import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { ExpensesClient } from '@/components/accounting/expenses-client'

export const metadata: Metadata = { title: 'Expenses' }

export default async function ExpensesPage() {
  const supabase = createAdminClient()

  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .order('expense_date', { ascending: false })
    .limit(200)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Expenses</h1>
        <p className="mt-0.5 text-sm text-text-secondary">Track operational costs by category</p>
      </div>
      <ExpensesClient initialExpenses={(expenses ?? []) as any} />
    </div>
  )
}
