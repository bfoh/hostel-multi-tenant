import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

import { getChartOfAccounts } from '@/lib/data/accounting'
import { getSuppliers } from '@/lib/data/suppliers'
import { NewRecurringBillForm } from '@/components/accounting/new-recurring-bill-form'

export const metadata: Metadata = { title: 'New Recurring Bill' }

export default async function NewRecurringBillPage() {
  const [accounts, suppliers] = await Promise.all([
    getChartOfAccounts(),
    getSuppliers(false),
  ])

  return (
    <div className="space-y-6">
      <div>
        <Link href="/accounting/recurring" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft className="h-4 w-4" />
          Back to Recurring
        </Link>
        <h1 className="mt-3 text-xl font-semibold text-text-primary">New recurring bill</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Used for predictable monthly costs like utilities, internet, rent, insurance premiums.
        </p>
      </div>

      <NewRecurringBillForm
        suppliers={suppliers.map((s) => ({
          id: s.id, name: s.name,
          payment_terms_days: s.payment_terms_days,
          default_expense_account_id: s.default_expense_account_id,
        }))}
        expenseAccounts={accounts.filter((a) => a.type === 'expense').map((a) => ({
          id: a.id, code: a.code, name: a.name,
        }))}
      />
    </div>
  )
}
