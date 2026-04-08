import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { RoomCategoryForm } from '@/components/rooms/room-category-form'

export const metadata: Metadata = { title: 'New Room Type' }

export default function NewRoomCategoryPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <Link
          href="/rooms/categories"
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Room types
        </Link>
        <h1 className="text-2xl font-bold text-text-primary">New Room Type</h1>
      </div>
      <RoomCategoryForm />
    </div>
  )
}
