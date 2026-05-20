import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

import { getChartOfAccounts } from '@/lib/data/accounting'
import { NewReportForm } from '@/components/accounting/new-report-form'

export const metadata: Metadata = { title: 'New Custom Report' }

export default async function NewReportPage() {
  const accounts = await getChartOfAccounts()
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/accounting/reports"
          className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to reports
        </Link>
        <h1 className="mt-3 text-xl font-semibold text-text-primary">New custom report</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Pick which accounts to include, the period, and how to group results. Save once — re-run any time.
        </p>
      </div>
      <NewReportForm
        accounts={accounts.map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type }))}
      />
    </div>
  )
}
