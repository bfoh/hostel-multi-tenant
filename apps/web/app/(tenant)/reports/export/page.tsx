import type { Metadata } from 'next'
import { ExportClient } from '@/components/reports/export-client'

export const metadata: Metadata = { title: 'Data Export' }

export default function ExportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Data Export</h1>
        <p className="text-sm text-text-secondary mt-1">Download your data as CSV files</p>
      </div>
      <ExportClient />
    </div>
  )
}
