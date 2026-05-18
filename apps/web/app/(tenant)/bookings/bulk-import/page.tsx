import type { Metadata } from 'next'
import { BulkBookingImportWizard } from '@/components/bookings/bulk-booking-import-wizard'

export const metadata: Metadata = { title: 'Bulk Import Bookings' }

export default function BulkBookingImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Bulk Import Bookings</h1>
        <p className="mt-0.5 text-sm text-text-secondary">
          Upload an Excel or CSV file to create many bookings at once. Occupants and rooms must already exist. All bookings created as <span className="font-medium">pending_payment</span>.
        </p>
      </div>
      <BulkBookingImportWizard />
    </div>
  )
}
