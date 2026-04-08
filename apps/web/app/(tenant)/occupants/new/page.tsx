import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { OccupantForm } from '@/components/occupants/occupant-form'

export const metadata: Metadata = { title: 'Add Occupant' }

export default async function NewOccupantPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>
}) {
  const { returnTo } = await searchParams

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <Link
          href={returnTo ?? '/occupants'}
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          {returnTo ? 'Back to booking' : 'Occupants'}
        </Link>
        <h1 className="text-2xl font-bold text-text-primary">Add Occupant</h1>
        {returnTo && (
          <p className="text-sm text-text-secondary">
            Save the occupant and you&apos;ll return to complete the booking.
          </p>
        )}
      </div>
      <OccupantForm returnTo={returnTo} />
    </div>
  )
}
