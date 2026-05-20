import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

import { getChartOfAccounts } from '@/lib/data/accounting'
import { NewJournalEntryForm } from '@/components/accounting/new-journal-entry-form'

export const metadata: Metadata = { title: 'New Journal Entry' }

export default async function NewJournalEntryPage() {
  const accounts = await getChartOfAccounts()

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/accounting/journal"
          className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Journal
        </Link>
        <h1 className="mt-3 text-xl font-semibold text-text-primary">New Journal Entry</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Manual double-entry posting. Total debits must equal total credits.
        </p>
      </div>

      <NewJournalEntryForm
        accounts={accounts.map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type }))}
      />
    </div>
  )
}
