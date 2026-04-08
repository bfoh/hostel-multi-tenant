'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const GHANA_REGIONS = [
  'Greater Accra', 'Ashanti', 'Eastern', 'Western', 'Central',
  'Volta', 'Northern', 'Upper East', 'Upper West', 'Brong-Ahafo',
  'Savannah', 'North East', 'Bono', 'Bono East', 'Oti', 'Western North', 'Ahafo',
]

const schema = z.object({
  first_name:         z.string().min(1, 'First name is required').max(100),
  last_name:          z.string().min(1, 'Last name is required').max(100),
  other_names:        z.string().max(100).optional(),
  phone:              z.string().min(10, 'Enter a valid phone number').max(15),
  alternate_phone:    z.string().max(15).optional(),
  email:              z.string().email('Enter a valid email').optional().or(z.literal('')),
  gender:             z.enum(['male', 'female', 'prefer_not_to_say']).optional(),
  date_of_birth:      z.string().optional(),
  type:               z.enum(['student', 'professional', 'guest', 'staff']),
  national_id_type:   z.enum(['ghana_card', 'passport', 'voters_id', 'nhis']).optional(),
  national_id_number: z.string().max(50).optional(),
  // Academic
  institution:        z.string().max(200).optional(),
  student_id:         z.string().max(50).optional(),
  programme:          z.string().max(200).optional(),
  year_of_study:      z.coerce.number().int().min(1).max(10).optional().or(z.literal('')),
  semester:           z.enum(['first', 'second', 'summer']).optional(),
  // Address
  home_address:       z.string().max(300).optional(),
  region_of_origin:   z.string().optional(),
  // Emergency contact
  ec_name:            z.string().max(200).optional(),
  ec_relationship:    z.string().max(100).optional(),
  ec_phone:           z.string().max(15).optional(),
  // Notes
  notes:              z.string().max(500).optional(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  defaultValues?: Partial<FormValues>
  occupantId?: string
  /** If set, redirect here (with ?occupant_id=<id>) after saving instead of the occupant detail page */
  returnTo?: string
}

export function OccupantForm({ defaultValues, occupantId, returnTo }: Props) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'student', ...defaultValues },
  })

  const occupantType = watch('type')

  async function onSubmit(values: FormValues) {
    setServerError(null)

    const emergencyContact =
      values.ec_name || values.ec_phone
        ? { name: values.ec_name, relationship: values.ec_relationship, phone: values.ec_phone }
        : null

    const payload = {
      first_name:         values.first_name,
      last_name:          values.last_name,
      other_names:        values.other_names || null,
      phone:              values.phone,
      alternate_phone:    values.alternate_phone || null,
      email:              values.email || null,
      gender:             values.gender || null,
      date_of_birth:      values.date_of_birth || null,
      type:               values.type,
      national_id_type:   values.national_id_type || null,
      national_id_number: values.national_id_number || null,
      institution:        values.institution || null,
      student_id:         values.student_id || null,
      programme:          values.programme || null,
      year_of_study:      values.year_of_study === '' ? null : values.year_of_study,
      semester:           values.semester || null,
      home_address:       values.home_address || null,
      region_of_origin:   values.region_of_origin || null,
      emergency_contact:  emergencyContact,
      notes:              values.notes || null,
    }

    const url = occupantId ? `/api/occupants/${occupantId}` : '/api/occupants'
    const method = occupantId ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setServerError(data.error ?? 'Something went wrong.')
      return
    }

    const data = await res.json()
    if (returnTo && data.id) {
      // Return to booking flow with new occupant pre-selected
      const url = new URL(returnTo, window.location.origin)
      url.searchParams.set('occupant_id', data.id)
      router.push(url.pathname + url.search)
    } else {
      router.push(`/occupants/${data.id}`)
    }
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {/* Personal details */}
      <Card>
        <CardHeader><CardTitle>Personal Details</CardTitle></CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="grid grid-cols-2 gap-4">
            <Field label="First name" required error={errors.first_name?.message}>
              <input {...register('first_name')} placeholder="Kofi" className="input-base" />
            </Field>
            <Field label="Last name" required error={errors.last_name?.message}>
              <input {...register('last_name')} placeholder="Asante" className="input-base" />
            </Field>
          </div>
          <Field label="Other names" error={errors.other_names?.message}>
            <input {...register('other_names')} placeholder="Middle name(s)" className="input-base" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Gender">
              <select {...register('gender')} className="input-base">
                <option value="">Select…</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </Field>
            <Field label="Date of birth">
              <input type="date" {...register('date_of_birth')} className="input-base" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="ID type">
              <select {...register('national_id_type')} className="input-base">
                <option value="">Select…</option>
                <option value="ghana_card">Ghana Card</option>
                <option value="passport">Passport</option>
                <option value="voters_id">Voter's ID</option>
                <option value="nhis">NHIS Card</option>
              </select>
            </Field>
            <Field label="ID number" error={errors.national_id_number?.message}>
              <input {...register('national_id_number')} placeholder="GHA-XXXXXXXXX-X" className="input-base" />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone number" required error={errors.phone?.message}>
              <input {...register('phone')} type="tel" placeholder="0241234567" className="input-base" />
            </Field>
            <Field label="Alternate phone" error={errors.alternate_phone?.message}>
              <input {...register('alternate_phone')} type="tel" placeholder="Optional" className="input-base" />
            </Field>
          </div>
          <Field label="Email address" error={errors.email?.message}>
            <input {...register('email')} type="email" placeholder="kofi@example.com" className="input-base" />
          </Field>
          <Field label="Home address" error={errors.home_address?.message}>
            <input {...register('home_address')} placeholder="Street, City, Region" className="input-base" />
          </Field>
          <Field label="Region of origin">
            <select {...register('region_of_origin')} className="input-base">
              <option value="">Select region…</option>
              {GHANA_REGIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </Field>
        </CardContent>
      </Card>

      {/* Occupant type + academic */}
      <Card>
        <CardHeader><CardTitle>Occupant Type</CardTitle></CardHeader>
        <CardContent className="space-y-4 pt-0">
          <Field label="Type" required>
            <select {...register('type')} className="input-base">
              <option value="student">Student</option>
              <option value="professional">Working Professional</option>
              <option value="guest">Guest</option>
              <option value="staff">Staff</option>
            </select>
          </Field>

          {occupantType === 'student' && (
            <>
              <Field label="Institution" error={errors.institution?.message}>
                <input {...register('institution')} placeholder="KNUST, UG, UCC…" className="input-base" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Student ID" error={errors.student_id?.message}>
                  <input {...register('student_id')} placeholder="20/0001234" className="input-base" />
                </Field>
                <Field label="Year of study" error={errors.year_of_study?.message}>
                  <input type="number" min={1} max={10} {...register('year_of_study')} placeholder="1-10" className="input-base" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Programme" error={errors.programme?.message}>
                  <input {...register('programme')} placeholder="BSc Computer Science…" className="input-base" />
                </Field>
                <Field label="Semester">
                  <select {...register('semester')} className="input-base">
                    <option value="">Select…</option>
                    <option value="first">First semester</option>
                    <option value="second">Second semester</option>
                    <option value="summer">Summer</option>
                  </select>
                </Field>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Emergency contact */}
      <Card>
        <CardHeader><CardTitle>Emergency Contact</CardTitle></CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Full name">
              <input {...register('ec_name')} placeholder="Ama Asante" className="input-base" />
            </Field>
            <Field label="Relationship">
              <input {...register('ec_relationship')} placeholder="Mother, Father…" className="input-base" />
            </Field>
          </div>
          <Field label="Phone number" error={errors.ec_phone?.message}>
            <input {...register('ec_phone')} type="tel" placeholder="0241234567" className="input-base" />
          </Field>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <textarea
            {...register('notes')}
            rows={3}
            placeholder="Any special notes about this occupant…"
            className="input-base resize-none"
          />
        </CardContent>
      </Card>

      {serverError && (
        <div className="rounded-md bg-danger-subtle px-3 py-2 text-sm text-danger">
          {serverError}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-surface-raised transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'Saving…' : occupantId ? 'Save changes' : 'Add occupant'}
        </button>
      </div>
    </form>
  )
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-text-primary">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
