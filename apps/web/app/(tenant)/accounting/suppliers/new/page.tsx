import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

import { getChartOfAccounts } from '@/lib/data/accounting'
import { SupplierForm } from '@/components/accounting/supplier-form'

export const metadata: Metadata = { title: 'New Supplier' }

export default async function NewSupplierPage() {
  const accounts = await getChartOfAccounts()
  const expenseAccounts = accounts
    .filter((a) => a.type === 'expense')
    .map((a) => ({ id: a.id, code: a.code, name: a.name }))

  return (
    <div className="space-y-6">
      <div>
        <Link href="/accounting/suppliers" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft className="h-4 w-4" />
          Back to Suppliers
        </Link>
        <h1 className="mt-3 text-xl font-semibold text-text-primary">New supplier</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Captures TIN + payment terms + default expense account so new bills prefill correctly
        </p>
      </div>

      <SupplierForm expenseAccounts={expenseAccounts} />
    </div>
  )
}
