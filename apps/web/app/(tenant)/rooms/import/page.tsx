import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { RoomImportClient } from '@/components/rooms/room-import-client'

export const metadata: Metadata = { title: 'Import Rooms' }

export default async function RoomImportPage() {
  const supabase = await createClient()
  const { data: categories } = await supabase
    .from('room_categories')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Import Rooms</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            Upload a CSV file to create or update rooms in bulk
          </p>
        </div>
        <Link href="/rooms" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
          ← Rooms
        </Link>
      </div>
      <RoomImportClient categories={categories ?? []} />
    </div>
  )
}
