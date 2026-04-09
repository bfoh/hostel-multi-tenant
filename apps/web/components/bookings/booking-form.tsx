'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatGHS } from '@/lib/utils'

const schema = z.object({
  occupant_id:    z.string().uuid('Select an occupant'),
  room_id:        z.string().uuid('Select a room'),
  check_in_date:  z.string().min(1, 'Check-in date is required'),
  check_out_date: z.string().min(1, 'Check-out date is required'),
  source:         z.enum(['walk_in', 'phone', 'website', 'widget', 'voice_ai', 'referral']),
  semester:       z.string().optional(),
  discount_amount:z.coerce.number().min(0).default(0),  // entered in GH₵, converted to pesewas on submit
  discount_reason:z.string().max(200).optional(),
  notes:          z.string().max(500).optional(),
})

type FormValues = z.infer<typeof schema>

interface Room {
  id: string
  room_number: string
  block: string | null
  floor: number | null
  status: string
  category: { id: string; name: string; type: string; base_rate: number; rate_unit: string; capacity: number } | { id: string; name: string; type: string; base_rate: number; rate_unit: string; capacity: number }[] | null
}

interface Occupant {
  id: string
  first_name: string
  last_name: string
  phone: string
  student_id: string | null
  institution: string | null
  status: string
}

interface Props {
  rooms: Room[]
  occupants: Occupant[]
  preselectedRoomId?: string
  preselectedOccupantId?: string
}

export function BookingForm({ rooms, occupants, preselectedRoomId, preselectedOccupantId }: Props) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      source:          'walk_in',
      discount_amount: 0,
      room_id:         preselectedRoomId ?? '',
      occupant_id:     preselectedOccupantId ?? '',
    },
  })

  const selectedRoomId = watch('room_id')
  const checkIn = watch('check_in_date')
  const checkOut = watch('check_out_date')
  const discountAmount = watch('discount_amount') ?? 0

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId)
  const roomCategory = selectedRoom?.category
    ? Array.isArray(selectedRoom.category) ? selectedRoom.category[0] : selectedRoom.category
    : null

  // Auto-set checkout = 1 semester forward when check_in changes
  useEffect(() => {
    if (checkIn && !checkOut) {
      const d = new Date(checkIn)
      d.setMonth(d.getMonth() + 4)  // approximate semester length
      setValue('check_out_date', d.toISOString().slice(0, 10))
    }
  }, [checkIn, checkOut, setValue])

  const totalAmount = roomCategory?.base_rate ?? 0
  const discountPesewas = Math.round(Number(discountAmount) * 100)
  const finalAmount = Math.max(0, totalAmount - discountPesewas)

  async function onSubmit(values: FormValues) {
    setServerError(null)

    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...values,
        discount_amount: Math.round(values.discount_amount * 100), // convert GH₵ → pesewas
      }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setServerError(data.error ?? 'Booking creation failed.')
      return
    }

    const data = await res.json()
    router.push(`/bookings/${data.id}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {/* Occupant selection */}
      <Card>
        <CardHeader><CardTitle>Occupant</CardTitle></CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              Select occupant <span className="text-danger">*</span>
            </label>
            {occupants.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-3 text-sm text-text-secondary">
                No occupants found.{' '}
                <a href="/occupants/new" className="text-brand underline">Add an occupant first.</a>
              </div>
            ) : (
              <select {...register('occupant_id')} className="input-base">
                <option value="">Select occupant…</option>
                {occupants.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.first_name} {o.last_name} — {o.phone}
                    {o.student_id ? ` (${o.student_id})` : ''}
                  </option>
                ))}
              </select>
            )}
            {errors.occupant_id && <p className="text-xs text-danger">{errors.occupant_id.message}</p>}
          </div>
          <div className="flex justify-end">
            <a
              href={`/occupants/new?returnTo=${encodeURIComponent('/bookings/new')}`}
              className="text-xs text-brand hover:text-brand-hover"
            >
              + Add new occupant
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Room selection */}
      <Card>
        <CardHeader><CardTitle>Room</CardTitle></CardHeader>
        <CardContent className="pt-0 space-y-3">
          {rooms.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-3 text-sm text-text-secondary">
              No available rooms.{' '}
              <a href="/rooms" className="text-brand underline">View rooms →</a>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Select room <span className="text-danger">*</span>
              </label>
              <select {...register('room_id')} className="input-base">
                <option value="">Select room…</option>
                {rooms.map((r) => {
                  const cat = Array.isArray(r.category) ? r.category[0] : r.category
                  return (
                    <option key={r.id} value={r.id}>
                      Room {r.room_number}
                      {r.block ? ` (Block ${r.block})` : ''}
                      {cat ? ` — ${cat.name} · ${formatGHS(cat.base_rate)}/${cat.rate_unit}` : ''}
                      {' '}· {(r as any).spotsRemaining ?? cat?.capacity ?? 1} spot{((r as any).spotsRemaining ?? cat?.capacity ?? 1) !== 1 ? 's' : ''} left
                    </option>
                  )
                })}
              </select>
              {errors.room_id && <p className="text-xs text-danger">{errors.room_id.message}</p>}
            </div>
          )}

          {roomCategory && (
            <div className="rounded-lg bg-brand-subtle px-3 py-2.5 text-sm">
              <p className="font-medium text-brand">{roomCategory.name}</p>
              <p className="mt-0.5 text-xs text-brand/70">
                Capacity: {roomCategory.capacity} · Rate:{' '}
                <span className="currency-amount">{formatGHS(roomCategory.base_rate)}/{roomCategory.rate_unit}</span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dates */}
      <Card>
        <CardHeader><CardTitle>Dates</CardTitle></CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Check-in <span className="text-danger">*</span>
              </label>
              <input type="date" {...register('check_in_date')} className="input-base" />
              {errors.check_in_date && <p className="text-xs text-danger">{errors.check_in_date.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Check-out <span className="text-danger">*</span>
              </label>
              <input type="date" {...register('check_out_date')} className="input-base" />
              {errors.check_out_date && <p className="text-xs text-danger">{errors.check_out_date.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Semester</label>
              <input
                type="text"
                placeholder="e.g. SEM1_2025"
                {...register('semester')}
                className="input-base"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Booking source</label>
              <select {...register('source')} className="input-base">
                <option value="walk_in">Walk-in</option>
                <option value="phone">Phone</option>
                <option value="website">Website</option>
                <option value="referral">Referral</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card>
        <CardHeader><CardTitle>Pricing</CardTitle></CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">Discount (GH₵)</label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-text-tertiary">GH₵</span>
              <input
                type="number"
                min={0}
                step={0.01}
                placeholder="0.00"
                {...register('discount_amount')}
                className="input-base pl-10 font-mono"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">Discount reason</label>
            <input
              type="text"
              placeholder="Early booking, loyalty, etc."
              {...register('discount_reason')}
              className="input-base"
            />
          </div>
          {roomCategory && (
            <div className="rounded-lg bg-surface-sunken px-3 py-2.5 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-text-secondary">Rate</span>
                <span className="currency-amount">{formatGHS(roomCategory.base_rate)}</span>
              </div>
              {discountPesewas > 0 && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">Discount</span>
                  <span className="currency-amount text-success">−{formatGHS(discountPesewas)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-1 font-semibold">
                <span>Total</span>
                <span className="currency-amount">{formatGHS(finalAmount)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <textarea
            rows={3}
            placeholder="Any special notes…"
            {...register('notes')}
            className="input-base resize-none"
          />
        </CardContent>
      </Card>

      {serverError && (
        <div className="rounded-md bg-danger-subtle px-3 py-2 text-sm text-danger">{serverError}</div>
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
          {isSubmitting ? 'Creating booking…' : 'Create Booking'}
        </button>
      </div>
    </form>
  )
}
