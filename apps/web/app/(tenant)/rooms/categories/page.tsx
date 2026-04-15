import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, Plus } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { formatGHS } from '@/lib/utils'

export const metadata: Metadata = { title: 'Room Types' }

async function getCategories() {
  const tenantId = await getServerTenantId()
  if (!tenantId) return []

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('room_categories')
    .select('id, name, type, base_rate, rate_unit, capacity, amenities, description, is_active, sort_order')
    .eq('tenant_id', tenantId)
    .order('sort_order')
  return data ?? []
}

export default async function RoomCategoriesPage() {
  const categories = await getCategories()

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link
            href="/rooms"
            className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Rooms
          </Link>
          <h1 className="text-2xl font-bold text-text-primary">Room Types</h1>
          <p className="text-sm text-text-secondary">
            Define room categories, pricing, and amenities for your hostel.
          </p>
        </div>
        <Link
          href="/rooms/categories/new"
          className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
        >
          <Plus className="h-4 w-4" />
          New type
        </Link>
      </div>

      {categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <p className="font-medium text-text-primary">No room types yet</p>
          <p className="text-sm text-text-secondary">
            Room types define your pricing and what each room includes.
          </p>
          <Link
            href="/rooms/categories/new"
            className="mt-2 flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create first room type
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((c) => (
            <div
              key={c.id}
              className="flex items-start justify-between rounded-xl border border-border bg-surface p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-text-primary">{c.name}</p>
                  {!c.is_active && (
                    <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] text-text-disabled">
                      Inactive
                    </span>
                  )}
                  <span className="rounded-full bg-brand-subtle px-2 py-0.5 text-[11px] font-medium text-brand capitalize">
                    {c.type}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-text-secondary">
                  {c.capacity} person{c.capacity !== 1 ? 's' : ''} ·{' '}
                  <span className="currency-amount">{formatGHS(c.base_rate)}</span>/{c.rate_unit}
                </p>
                {c.description && (
                  <p className="mt-1 text-xs text-text-tertiary">{c.description}</p>
                )}
                {c.amenities?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {c.amenities.slice(0, 5).map((a: string) => (
                      <span
                        key={a}
                        className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] text-text-secondary"
                      >
                        {a}
                      </span>
                    ))}
                    {c.amenities.length > 5 && (
                      <span className="text-[11px] text-text-tertiary">
                        +{c.amenities.length - 5} more
                      </span>
                    )}
                  </div>
                )}
              </div>
              <Link
                href={`/rooms/categories/${c.id}/edit`}
                className="ml-4 shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-raised transition-colors"
              >
                Edit
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
