import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

import { getRoomCategories } from '@/lib/data/rooms'
import { RoomForm } from '@/components/rooms/room-form'

export const metadata: Metadata = { title: 'Add Room' }

export default async function NewRoomPage() {
  const categories = await getRoomCategories()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <Link
          href="/rooms"
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Rooms
        </Link>
        <h1 className="text-2xl font-bold text-text-primary">Add Room</h1>
      </div>

      <RoomForm categories={categories} />
    </div>
  )
}
