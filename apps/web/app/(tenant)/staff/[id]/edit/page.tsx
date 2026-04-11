import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

import { getStaffById } from '@/lib/data/staff'
import { StaffEditForm } from '@/components/staff/staff-edit-form'

export const metadata: Metadata = { title: 'Edit Staff Member' }

export default async function EditStaffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const staff = await getStaffById(id)
  if (!staff) notFound()

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link
          href={`/staff/${id}`}
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          {staff.first_name} {staff.last_name}
        </Link>
        <span className="text-text-disabled">/</span>
        <span className="text-sm text-text-primary">Edit</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-text-primary">Edit staff member</h1>
        <p className="mt-0.5 text-sm text-text-secondary">Update profile details for {staff.first_name} {staff.last_name}.</p>
      </div>

      <StaffEditForm staffId={id} initial={staff} />
    </div>
  )
}
