import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { RoomCategoryForm } from '@/components/rooms/room-category-form'

export const metadata: Metadata = { title: 'Edit Room Type' }

async function getCategory(id: string) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return null

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('room_categories')
    .select('id, name, type, base_rate, rate_unit, capacity, description, amenities, is_active')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()
  return data
}

export default async function EditRoomCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const category = await getCategory(id)

  if (!category) notFound()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <Link
          href="/rooms/categories"
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Room Types
        </Link>
        <h1 className="text-2xl font-bold text-text-primary">Edit Room Type</h1>
        <p className="text-sm text-text-secondary">Update pricing, capacity, and amenities.</p>
      </div>

      <RoomCategoryForm
        categoryId={category.id}
        defaultValues={{
          name:        category.name,
          type:        category.type as any,
          base_rate:   category.base_rate,
          rate_unit:   category.rate_unit as any,
          capacity:    category.capacity,
          description: category.description ?? undefined,
          amenities:   category.amenities ?? [],
          is_active:   category.is_active,
        }}
      />
    </div>
  )
}
