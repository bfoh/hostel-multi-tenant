import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { RoomHKCard } from '@/components/housekeeping/room-hk-card'

export const metadata: Metadata = { title: 'Housekeeping' }

type HKStatus = 'clean' | 'dirty' | 'inspecting' | 'out_of_order'

const STATUS_FILTERS: { value: string; label: string; dot: string }[] = [
  { value: 'all',          label: 'All',          dot: 'bg-border' },
  { value: 'dirty',        label: 'Dirty',        dot: 'bg-warning' },
  { value: 'inspecting',   label: 'Inspecting',   dot: 'bg-info' },
  { value: 'clean',        label: 'Clean',        dot: 'bg-success' },
  { value: 'out_of_order', label: 'Out of Order', dot: 'bg-danger' },
]

async function getRooms(filter: string) {
  const supabase = await createClient()

  let query = supabase
    .from('rooms')
    .select(`
      id, room_number, block, floor, status, housekeeping_status,
      last_cleaned_at, last_inspected_at,
      category:room_categories(name)
    `)
    .order('room_number')

  if (filter !== 'all') {
    query = query.eq('housekeeping_status', filter as HKStatus)
  }

  const { data } = await query
  return data ?? []
}

export default async function HousekeepingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status = 'all' } = await searchParams
  const rooms = await getRooms(status)

  // Counts for summary bar (always fetch all for counts)
  const supabase = await createClient()
  const { data: allRooms } = await supabase
    .from('rooms')
    .select('housekeeping_status')

  const counts = {
    dirty:        allRooms?.filter((r) => r.housekeeping_status === 'dirty').length        ?? 0,
    inspecting:   allRooms?.filter((r) => r.housekeeping_status === 'inspecting').length   ?? 0,
    clean:        allRooms?.filter((r) => r.housekeeping_status === 'clean').length        ?? 0,
    out_of_order: allRooms?.filter((r) => r.housekeeping_status === 'out_of_order').length ?? 0,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Housekeeping</h1>
        <p className="mt-0.5 text-sm text-text-secondary">Track and update room cleaning status</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-danger/20 bg-danger-subtle p-4">
          <p className="text-xs text-danger">Needs cleaning</p>
          <p className="mt-1 text-2xl font-bold text-danger">{counts.dirty}</p>
          <p className="mt-0.5 text-xs text-danger/70">dirty</p>
        </div>
        <div className="rounded-xl border border-info/20 bg-info-subtle p-4">
          <p className="text-xs text-info">In progress</p>
          <p className="mt-1 text-2xl font-bold text-info">{counts.inspecting}</p>
          <p className="mt-0.5 text-xs text-info/70">inspecting</p>
        </div>
        <div className="rounded-xl border border-success/20 bg-success-subtle p-4">
          <p className="text-xs text-success">Ready</p>
          <p className="mt-1 text-2xl font-bold text-success">{counts.clean}</p>
          <p className="mt-0.5 text-xs text-success/70">clean</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-text-tertiary">Out of order</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{counts.out_of_order}</p>
          <p className="mt-0.5 text-xs text-text-tertiary">maintenance</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === 'all' ? '/housekeeping' : `/housekeeping?status=${f.value}`}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              status === f.value || (f.value === 'all' && !status)
                ? 'bg-brand text-brand-fg'
                : 'bg-surface-raised text-text-secondary hover:text-text-primary'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${f.dot}`} />
            {f.label}
            {f.value !== 'all' && (
              <span className="ml-0.5 opacity-70">
                ({counts[f.value as keyof typeof counts] ?? 0})
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* Room grid */}
      {rooms.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <p className="font-medium text-text-primary">No rooms found</p>
          <p className="text-sm text-text-secondary">
            {status !== 'all'
              ? `No rooms with status "${status}".`
              : 'Add rooms to start tracking housekeeping.'}
          </p>
          {status === 'all' && (
            <Link
              href="/rooms/new"
              className="mt-1 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
            >
              Add room
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rooms.map((room) => (
            <RoomHKCard key={room.id} room={room as any} />
          ))}
        </div>
      )}
    </div>
  )
}
