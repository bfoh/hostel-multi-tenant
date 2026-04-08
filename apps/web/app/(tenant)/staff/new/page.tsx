import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

import { AddStaffForm } from '@/components/staff/add-staff-form'

export const metadata: Metadata = { title: 'Add Staff Member' }

export default function NewStaffPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link
          href="/staff"
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Staff
        </Link>
        <span className="text-text-disabled">/</span>
        <span className="text-sm text-text-primary">New staff member</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-text-primary">Add staff member</h1>
        <p className="mt-0.5 text-sm text-text-secondary">
          Fill in the details to create a new team member profile.
        </p>
      </div>

      <AddStaffForm />
    </div>
  )
}
