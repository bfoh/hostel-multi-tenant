import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { createTenantAdminClient } from '@/lib/supabase/tenant-admin'
import { RoomHKCard } from '@/components/housekeeping/room-hk-card'
import { HkTaskRow } from '@/components/housekeeping/hk-task-row'
import { Search } from 'lucide-react'
import { applySearchTerms, DEFAULT_LIST_PAGE_SIZE, normalisePage } from '@/lib/data/listing'
import { ListPagination } from '@/components/ui/list-pagination'

export const metadata: Metadata = { title: 'Housekeeping' }

type HKStatus = 'clean' | 'dirty' | 'inspecting' | 'out_of_order'

const STATUS_FILTERS: { value: string; label: string; dot: string }[] = [
  { value: 'all',          label: 'All',          dot: 'bg-border' },
  { value: 'dirty',        label: 'Dirty',        dot: 'bg-warning' },
  { value: 'inspecting',   label: 'Inspecting',   dot: 'bg-info' },
  { value: 'clean',        label: 'Clean',        dot: 'bg-success' },
  { value: 'out_of_order', label: 'Out of Order', dot: 'bg-danger' },
]

const PRIORITY_STYLE: Record<string, string> = {
  urgent: 'text-danger',
  high:   'text-warning',
  normal: 'text-text-secondary',
  low:    'text-text-tertiary',
}

async function getRooms(filter: string, search: string, requestedPage: number, tenantId: string) {
  if (!tenantId) return { rows: [], total: 0, page: 1, pageSize: DEFAULT_LIST_PAGE_SIZE }
  const supabase = createTenantAdminClient(tenantId)

  let query = supabase
    .from('rooms')
    .select(`
      id, room_number, block, floor, status, housekeeping_status,
      last_cleaned_at, last_inspected_at,
      category:room_categories(name)
    `, { count: 'exact' })
    .order('room_number')

  if (filter !== 'all') {
    query = query.eq('housekeeping_status', filter as HKStatus)
  }

  query = applySearchTerms(query, ['room_number', 'block'], search)
  const page = normalisePage(requestedPage)
  const offset = (page - 1) * DEFAULT_LIST_PAGE_SIZE
  const { data, count } = await query.range(offset, offset + DEFAULT_LIST_PAGE_SIZE - 1)
  return { rows: data ?? [], total: count ?? 0, page, pageSize: DEFAULT_LIST_PAGE_SIZE }
}

async function getPendingTasks(tenantId: string) {
  if (!tenantId) return []
  const supabase = createTenantAdminClient(tenantId)
  const { data } = await supabase
    .from('housekeeping_tasks')
    .select(`
      id, status, priority, due_by, notes, source, created_at,
      rooms(id, room_number, block),
      staff_profiles(id, first_name, last_name)
    `)
    .not('status', 'in', '("done","skipped")')
    .order('due_by', { ascending: true, nullsFirst: false })
    .order('priority')
    .limit(30)
  return data ?? []
}

export default async function HousekeepingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>
}) {
  const { status = 'all', q = '', page: pageParam } = await searchParams

  const headersList = await headers()
  const tenantId    = headersList.get('x-tenant-id') ?? ''

  const [roomResult, tasks] = await Promise.all([
    getRooms(status, q, Number.parseInt(pageParam ?? '1', 10), tenantId),
    getPendingTasks(tenantId),
  ])
  const { rows: rooms, total: roomTotal, page, pageSize } = roomResult

  // Counts for summary bar (always fetch all for counts)
  const supabase = createTenantAdminClient(tenantId)
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

      <form method="get" className="flex max-w-md gap-2">
        {status !== 'all' && <input type="hidden" name="status" value={status} />}
        <div className="relative flex-1">
          <Search className="text-text-disabled pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search room or block…"
            className="border-border bg-surface text-text-primary placeholder:text-text-disabled focus:border-brand w-full rounded-md border py-2 pl-9 pr-3 text-sm focus:outline-none"
          />
        </div>
        <button className="bg-brand text-brand-fg hover:bg-brand-hover rounded-md px-3 py-2 text-sm font-semibold">Search</button>
      </form>

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
          <p className="text-xs text-text-tertiary">Pending tasks</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{tasks.length}</p>
          <p className="mt-0.5 text-xs text-text-tertiary">to action</p>
        </div>
      </div>

      {/* ── Pending tasks ───────────────────────────────────────────── */}
      {tasks.length > 0 && (
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-surface-raised">
            <h2 className="text-sm font-semibold text-text-primary">Cleaning Tasks</h2>
            <span className="text-xs text-text-tertiary">{tasks.length} pending</span>
          </div>
          <div className="divide-y divide-border">
            {tasks.map(task => (
              <HkTaskRow key={(task as any).id} task={task as any} priorityStyle={PRIORITY_STYLE} />
            ))}
          </div>
        </div>
      )}

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
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rooms.map((room) => (
              <RoomHKCard key={room.id} room={room as any} />
            ))}
          </div>
          <ListPagination pathname="/housekeeping" page={page} pageSize={pageSize} total={roomTotal} params={{ status: status === 'all' ? undefined : status, q }} />
        </>
      )}
    </div>
  )
}
