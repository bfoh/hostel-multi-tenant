import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

import { getOccupantById } from '@/lib/data/occupants'
import { OccupantForm } from '@/components/occupants/occupant-form'

export const metadata: Metadata = { title: 'Edit Occupant' }

export default async function EditOccupantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const o = await getOccupantById(id)
  if (!o) notFound()

  const ec = o.emergency_contact as Record<string, string> | null

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <Link href={`/occupants/${id}`} className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft className="h-4 w-4" />
          {o.first_name} {o.last_name}
        </Link>
        <h1 className="text-2xl font-bold text-text-primary">Edit Occupant</h1>
      </div>
      <OccupantForm
        occupantId={id}
        defaultValues={{
          first_name:         o.first_name,
          last_name:          o.last_name,
          other_names:        o.other_names ?? undefined,
          phone:              o.phone,
          alternate_phone:    o.alternate_phone ?? undefined,
          email:              o.email ?? undefined,
          gender:             o.gender ?? undefined,
          date_of_birth:      o.date_of_birth ?? undefined,
          type:               (o.type as 'student' | 'professional' | 'guest' | 'staff') ?? 'guest',
          national_id_type:   o.national_id_type ?? undefined,
          national_id_number: o.national_id_number ?? undefined,
          institution:        o.institution ?? undefined,
          student_id:         o.student_id ?? undefined,
          programme:          o.programme ?? undefined,
          year_of_study:      o.year_of_study ?? undefined,
          semester:           (o.semester as 'first' | 'second' | 'summer' | null) ?? undefined,
          home_address:       o.home_address ?? undefined,
          region_of_origin:   o.region_of_origin ?? undefined,
          ec_name:            ec?.name ?? undefined,
          ec_relationship:    ec?.relationship ?? undefined,
          ec_phone:           ec?.phone ?? undefined,
          notes:              o.notes ?? undefined,
        }}
      />
    </div>
  )
}
