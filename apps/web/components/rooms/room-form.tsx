'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { Card, CardContent } from '@/components/ui/card'

const schema = z.object({
  room_number:  z.string().min(1, 'Room number is required').max(20),
  category_id:  z.string().uuid('Select a room type'),
  floor:        z.coerce.number().int().min(0).max(100).optional().or(z.literal('')),
  block:        z.string().max(20).optional(),
  notes:        z.string().max(500).optional(),
})

type FormValues = z.infer<typeof schema>

interface Category {
  id: string
  name: string
  type: string
  base_rate: number
  rate_unit: string
  capacity: number
}

interface Props {
  categories: Category[]
  defaultValues?: Partial<FormValues>
  roomId?: string  // if editing
}

export function RoomForm({ categories, defaultValues, roomId }: Props) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {},
  })

  async function onSubmit(values: FormValues) {
    setServerError(null)

    const payload = {
      room_number: values.room_number,
      category_id: values.category_id,
      floor: values.floor === '' ? null : values.floor,
      block: values.block || null,
      notes: values.notes || null,
    }

    const url = roomId ? `/api/rooms/${roomId}` : '/api/rooms'
    const method = roomId ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setServerError(data.error ?? 'Something went wrong. Please try again.')
      return
    }

    const data = await res.json()
    router.push(`/rooms/${data.id}`)
    router.refresh()
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          {/* Room number */}
          <div className="space-y-1.5">
            <label htmlFor="room_number" className="text-sm font-medium text-text-primary">
              Room number <span className="text-danger">*</span>
            </label>
            <input
              id="room_number"
              type="text"
              placeholder="101, A-201, B3…"
              {...register('room_number')}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand transition-colors"
            />
            {errors.room_number && (
              <p className="text-xs text-danger">{errors.room_number.message}</p>
            )}
          </div>

          {/* Room type */}
          <div className="space-y-1.5">
            <label htmlFor="category_id" className="text-sm font-medium text-text-primary">
              Room type <span className="text-danger">*</span>
            </label>
            {categories.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-surface-sunken px-3 py-3 text-sm text-text-secondary">
                No room types configured.{' '}
                <a href="/rooms/categories/new" className="text-brand underline">
                  Create a room type first.
                </a>
              </div>
            ) : (
              <select
                id="category_id"
                {...register('category_id')}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand transition-colors"
              >
                <option value="">Select room type…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — GH₵{(c.base_rate / 100).toFixed(2)}/{c.rate_unit}
                  </option>
                ))}
              </select>
            )}
            {errors.category_id && (
              <p className="text-xs text-danger">{errors.category_id.message}</p>
            )}
          </div>

          {/* Block + Floor */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="block" className="text-sm font-medium text-text-primary">
                Block / Wing
              </label>
              <input
                id="block"
                type="text"
                placeholder="A, B, North…"
                {...register('block')}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="floor" className="text-sm font-medium text-text-primary">
                Floor
              </label>
              <input
                id="floor"
                type="number"
                min={0}
                max={100}
                placeholder="0 = ground"
                {...register('floor')}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand transition-colors"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label htmlFor="notes" className="text-sm font-medium text-text-primary">
              Notes
            </label>
            <textarea
              id="notes"
              rows={3}
              placeholder="Any special notes about this room…"
              {...register('notes')}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand transition-colors resize-none"
            />
            {errors.notes && (
              <p className="text-xs text-danger">{errors.notes.message}</p>
            )}
          </div>

          {serverError && (
            <div className="rounded-md bg-danger-subtle px-3 py-2 text-sm text-danger">
              {serverError}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-surface-raised transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || categories.length === 0}
              className="flex-1 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving…' : roomId ? 'Save changes' : 'Add room'}
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
