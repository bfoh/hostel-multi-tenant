import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

import { getRoomById, getRoomCategories } from '@/lib/data/rooms'
import { RoomForm } from '@/components/rooms/room-form'

export const metadata: Metadata = { title: 'Edit Room' }

export default async function EditRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [room, categories] = await Promise.all([getRoomById(id), getRoomCategories()])

  if (!room) notFound()

  const category = Array.isArray(room.category) ? room.category[0] : room.category

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <Link
          href={`/rooms/${id}`}
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Room {room.room_number}
        </Link>
        <h1 className="text-2xl font-bold text-text-primary">Edit Room {room.room_number}</h1>
      </div>

      <RoomForm
        categories={categories}
        roomId={id}
        defaultValues={{
          room_number: room.room_number,
          category_id: category?.id ?? '',
          floor: room.floor ?? undefined,
          block: room.block ?? undefined,
          notes: room.notes ?? undefined,
        }}
      />
    </div>
  )
}
