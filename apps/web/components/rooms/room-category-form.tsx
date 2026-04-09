'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'

const ROOM_TYPES = ['single', 'double', 'twin', 'triple', 'quad', 'dormitory', 'suite', 'studio'] as const
const RATE_UNITS = ['night', 'week', 'month', 'semester'] as const

const COMMON_AMENITIES = [
  'Private bathroom', 'Shared bathroom', 'Air conditioning', 'Ceiling fan',
  'Study desk', 'Wardrobe', 'WiFi', 'Generator backup', 'Water heater',
  'CCTV', '24/7 security', 'Balcony', 'Kitchen access', 'Laundry access',
]

const schema = z.object({
  name:        z.string().min(2, 'Name must be at least 2 characters').max(100),
  type:        z.enum(ROOM_TYPES),
  base_rate:   z.coerce.number().min(0.01, 'Rate must be at least GH₵0.01'),
  rate_unit:   z.enum(RATE_UNITS),
  capacity:    z.coerce.number().int().min(1).max(20),
  description: z.string().max(500).optional(),
  amenities:   z.array(z.string()).default([]),
  is_active:   z.boolean().default(true),
})

type FormValues = z.infer<typeof schema>

interface Props {
  /** defaultValues.base_rate should be in PESEWAS (as stored in DB) */
  defaultValues?: Partial<FormValues & { base_rate: number }>
  categoryId?: string
}

export function RoomCategoryForm({ defaultValues, categoryId }: Props) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [customAmenity, setCustomAmenity] = useState('')

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      type: 'single',
      rate_unit: 'semester',
      capacity: 1,
      amenities: [],
      is_active: true,
      ...defaultValues,
      // Convert stored pesewas → cedis for display
      base_rate: defaultValues?.base_rate != null
        ? defaultValues.base_rate / 100
        : undefined,
    },
  })

  const selectedAmenities = watch('amenities')

  function toggleAmenity(amenity: string) {
    const current = selectedAmenities ?? []
    if (current.includes(amenity)) {
      setValue('amenities', current.filter((a) => a !== amenity))
    } else {
      setValue('amenities', [...current, amenity])
    }
  }

  function addCustomAmenity() {
    const val = customAmenity.trim()
    if (!val || selectedAmenities?.includes(val)) return
    setValue('amenities', [...(selectedAmenities ?? []), val])
    setCustomAmenity('')
  }

  async function onSubmit(values: FormValues) {
    setServerError(null)

    const url = categoryId ? `/api/room-categories/${categoryId}` : '/api/room-categories'
    const method = categoryId ? 'PUT' : 'POST'

    // Convert cedis → pesewas before sending to API
    const payload = { ...values, base_rate: Math.round(values.base_rate * 100) }

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

    router.push('/rooms/categories')
    router.refresh()
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          {/* Name */}
          <div className="space-y-1.5">
            <label htmlFor="name" className="text-sm font-medium text-text-primary">
              Type name <span className="text-danger">*</span>
            </label>
            <input
              id="name"
              type="text"
              placeholder="Executive Single, Standard Double…"
              {...register('name')}
              className="input-base"
            />
            {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
          </div>

          {/* Type + Capacity */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="type" className="text-sm font-medium text-text-primary">
                Room type <span className="text-danger">*</span>
              </label>
              <select id="type" {...register('type')} className="input-base">
                {ROOM_TYPES.map((t) => (
                  <option key={t} value={t} className="capitalize">{t}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="capacity" className="text-sm font-medium text-text-primary">
                Capacity <span className="text-danger">*</span>
              </label>
              <input
                id="capacity"
                type="number"
                min={1}
                max={20}
                {...register('capacity')}
                className="input-base"
              />
              {errors.capacity && <p className="text-xs text-danger">{errors.capacity.message}</p>}
            </div>
          </div>

          {/* Base rate + Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="base_rate" className="text-sm font-medium text-text-primary">
                Base rate (GH₵) <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-text-tertiary">
                  GH₵
                </span>
                <input
                  id="base_rate"
                  type="number"
                  min={0.01}
                  step={0.01}
                  placeholder="800.00"
                  {...register('base_rate')}
                  className="input-base pl-10 font-mono"
                />
              </div>
              {errors.base_rate && <p className="text-xs text-danger">{errors.base_rate.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="rate_unit" className="text-sm font-medium text-text-primary">
                Per
              </label>
              <select id="rate_unit" {...register('rate_unit')} className="input-base">
                {RATE_UNITS.map((u) => (
                  <option key={u} value={u} className="capitalize">{u}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label htmlFor="description" className="text-sm font-medium text-text-primary">
              Description
            </label>
            <textarea
              id="description"
              rows={2}
              placeholder="Brief description shown on the booking page…"
              {...register('description')}
              className="input-base resize-none"
            />
          </div>

          {/* Amenities */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-text-primary">Amenities</p>
            <div className="flex flex-wrap gap-2">
              {COMMON_AMENITIES.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleAmenity(a)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                    selectedAmenities?.includes(a)
                      ? 'border-brand bg-brand-subtle text-brand'
                      : 'border-border text-text-secondary hover:border-brand/40 hover:text-text-primary'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>

            {/* Custom amenity input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={customAmenity}
                onChange={(e) => setCustomAmenity(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomAmenity())}
                placeholder="Add custom amenity…"
                className="flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand transition-colors"
              />
              <button
                type="button"
                onClick={addCustomAmenity}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-raised transition-colors"
              >
                Add
              </button>
            </div>

            {/* Selected custom amenities */}
            {selectedAmenities?.filter((a) => !COMMON_AMENITIES.includes(a)).map((a) => (
              <span
                key={a}
                className="inline-flex items-center gap-1 rounded-full border border-brand/20 bg-brand-subtle px-2.5 py-1 text-xs font-medium text-brand"
              >
                {a}
                <button type="button" onClick={() => toggleAmenity(a)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <Controller
              control={control}
              name="is_active"
              render={({ field }) => (
                <button
                  type="button"
                  role="switch"
                  aria-checked={field.value}
                  onClick={() => field.onChange(!field.value)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-brand/25 ${
                    field.value ? 'bg-brand' : 'bg-border'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      field.value ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              )}
            />
            <label className="text-sm text-text-primary">Active (visible for new bookings)</label>
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
              disabled={isSubmitting}
              className="flex-1 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Saving…' : categoryId ? 'Save changes' : 'Create room type'}
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
