import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

import { getChartOfAccounts } from '@/lib/data/accounting'
import { NewBillForm } from '@/components/accounting/new-bill-form'

export const metadata: Metadata = { title: 'New Supplier Bill' }

export default async function NewBillPage() {
  const accounts = await getChartOfAccounts()
  const expenseAccounts = accounts
    .filter((a) => a.type === 'expense')
    .map((a) => ({ id: a.id, code: a.code, name: a.name }))

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/accounting/ap"
          className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Accounts Payable
        </Link>
        <h1 className="mt-3 text-xl font-semibold text-text-primary">New supplier bill</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Captured bills start in draft. Approve to post the accrual journal entry; payments post on settle.
        </p>
      </div>

      <NewBillForm expenseAccounts={expenseAccounts} />
    </div>
  )
}
