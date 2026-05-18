import type { Metadata } from 'next'
import { BulkImportWizard } from '@/components/occupants/bulk-import-wizard'

export const metadata: Metadata = { title: 'Bulk Import Occupants' }

export default function BulkImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Bulk Import Occupants</h1>
        <p className="mt-0.5 text-sm text-text-secondary">
          Upload an Excel or CSV file to add many occupants at once. All occupants will be created with status <span className="font-medium">pending</span>.
        </p>
      </div>
      <BulkImportWizard />
    </div>
  )
}
