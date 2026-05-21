import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

import { getChartOfAccounts } from '@/lib/data/accounting'
import { NewRecurringJournalForm } from '@/components/accounting/new-recurring-journal-form'

export const metadata: Metadata = { title: 'New Recurring Journal' }

export default async function NewRecurringJournalPage() {
  const accounts = await getChartOfAccounts()
  return (
    <div className="space-y-6">
      <div>
        <Link href="/accounting/recurring" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft className="h-4 w-4" />
          Back to Recurring
        </Link>
        <h1 className="mt-3 text-xl font-semibold text-text-primary">New recurring journal template</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Typical uses: monthly prepaid expense amortization, accrued interest, recurring rent expense recognition.
        </p>
      </div>

      <NewRecurringJournalForm
        accounts={accounts.map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type }))}
      />
    </div>
  )
}
