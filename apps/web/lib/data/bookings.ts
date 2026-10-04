import { createTenantAdminClient } from '@/lib/supabase/tenant-admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { containsFilter } from '@/lib/data/listing'

const BOOKINGS_PAGE_SIZE = 100

type BookingFilters = {
  status?: string
  search?: string
  from?: string
  to?: string
  page?: number
}

function intersectIds(groups: string[][]) {
  if (groups.length === 0) return []
  return groups.slice(1).reduce((matches, group) => {
    const allowed = new Set(group)
    return matches.filter((id) => allowed.has(id))
  }, groups[0])
}

async function findOccupantIds(
  supabase: ReturnType<typeof createTenantAdminClient>,
  search: string,
) {
  // Treat words as AND terms across all occupant fields. This means a search
  // such as "Francis Otoo" matches first_name=Francis + last_name=Otoo,
  // instead of requiring the whole phrase to exist in either column.
  const terms = search.split(/\s+/).filter(Boolean)
  const matchesByTerm = await Promise.all(
    terms.map(async (term) => {
      const filters = [
        'first_name',
        'last_name',
        'other_names',
        'phone',
        'alternate_phone',
        'email',
        'student_id',
        'national_id_number',
      ].map((column) => containsFilter(column, term))
      const { data, error } = await supabase.from('occupants').select('id').or(filters.join(','))
      if (error) return []
      return (data ?? []).map((occupant) => occupant.id)
    }),
  )

  return intersectIds(matchesByTerm)
}

async function findRoomIds(
  supabase: ReturnType<typeof createTenantAdminClient>,
  search: string,
) {
  const roomSearch = search.replace(/^room\s+/i, '').trim()
  if (!roomSearch) return []

  const filters = ['room_number', 'block'].map((column) => containsFilter(column, roomSearch))
  const { data, error } = await supabase.from('rooms').select('id').or(filters.join(','))
  if (error) return []
  return (data ?? []).map((room) => room.id)
}

export async function getBookingsPage(filter: BookingFilters = {}) {
  const tenantId = await getServerTenantId()
  if (!tenantId) {
    return { bookings: [], total: 0, page: 1, pageSize: BOOKINGS_PAGE_SIZE }
  }

  const supabase = createTenantAdminClient(tenantId)
  const requestedPage = Number.isFinite(filter.page) ? Math.max(1, Math.floor(filter.page!)) : 1
  const search = filter.search?.trim()

  const [occupantIds, roomIds] = search
    ? await Promise.all([findOccupantIds(supabase, search), findRoomIds(supabase, search)])
    : [[], []]

  let query = supabase
    .from('bookings')
    .select(`
      id, booking_ref, status, payment_status, source, group_id,
      check_in_date, check_out_date, final_amount, paid_amount, created_at,
      occupant:occupants(id, first_name, last_name, phone, student_id, institution),
      room:rooms(id, room_number, block, category:room_categories(name))
    `, { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (filter?.status && filter.status !== 'all') {
    // filter.status comes from URL search params (string); cast is safe as DB ignores invalid values
    query = query.eq('status', filter.status as 'enquiry')
  }
  if (filter?.from) query = query.gte('check_in_date', filter.from)
  if (filter?.to)   query = query.lte('check_in_date', filter.to)

  if (search) {
    const filters = [containsFilter('booking_ref', search)]
    if (occupantIds.length > 0) filters.push(`occupant_id.in.(${occupantIds.join(',')})`)
    if (roomIds.length > 0) filters.push(`room_id.in.(${roomIds.join(',')})`)
    query = query.or(filters.join(','))
  }

  const offset = (requestedPage - 1) * BOOKINGS_PAGE_SIZE
  let { data, error, count } = await query.range(offset, offset + BOOKINGS_PAGE_SIZE - 1)
  if (error) {
    return { bookings: [], total: 0, page: requestedPage, pageSize: BOOKINGS_PAGE_SIZE }
  }

  const total = count ?? 0
  const lastPage = Math.max(1, Math.ceil(total / BOOKINGS_PAGE_SIZE))
  const page = Math.min(requestedPage, lastPage)

  // A stale/out-of-range page URL should still show the final real page.
  if (requestedPage !== page && total > 0) {
    const finalOffset = (page - 1) * BOOKINGS_PAGE_SIZE
    const result = await query.range(finalOffset, finalOffset + BOOKINGS_PAGE_SIZE - 1)
    if (!result.error) data = result.data
  }

  return {
    bookings: data ?? [],
    total,
    page,
    pageSize: BOOKINGS_PAGE_SIZE,
  }
}

export async function getBookings(filter?: BookingFilters) {
  const result = await getBookingsPage(filter)
  return result.bookings
}

export async function getBookingById(id: string) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return null

  const supabase = createTenantAdminClient(tenantId)

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id, booking_ref, status, payment_status, source, semester, academic_year,
      check_in_date, check_out_date, actual_check_in, actual_check_out,
      rate_per_unit, rate_unit, total_amount, discount_amount, discount_reason,
      tax_amount, final_amount, paid_amount, notes, created_at, updated_at,
      cancellation_reason, cancelled_at,
      occupant:occupants(
        id, first_name, last_name, other_names, phone, email, student_id,
        institution, programme, year_of_study, photo_url
      ),
      room:rooms(
        id, room_number, block, floor,
        category:room_categories(name, type, base_rate, rate_unit, capacity)
      ),
      booking_payments(
        id, amount, method, reference, paystack_reference, status, paid_at, notes
      )
    `)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) return null
  return data
}

export async function getAvailableRooms(checkIn: string, checkOut: string) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return []

  const supabase = createTenantAdminClient(tenantId)

  // Count active bookings per room that overlap the requested period
  const { data: activeBookings } = await supabase
    .from('bookings')
    .select('room_id')
    .eq('tenant_id', tenantId)
    .lte('check_in_date', checkOut)
    .gte('check_out_date', checkIn)
    .in('status', ['pending_payment', 'confirmed', 'checked_in'])

  // Build a map: room_id → active booking count
  const bookingCount: Record<string, number> = {}
  for (const b of activeBookings ?? []) {
    bookingCount[b.room_id] = (bookingCount[b.room_id] ?? 0) + 1
  }

  // Fetch all non-maintenance, non-blocked rooms with their category capacity
  const { data: rooms, error } = await supabase
    .from('rooms')
    .select(`
      id, room_number, block, floor, status,
      category:room_categories(id, name, type, base_rate, rate_unit, capacity, amenities)
    `)
    .eq('tenant_id', tenantId)
    .not('status', 'in', '(maintenance,blocked)')
    .order('room_number')

  if (error) return []

  // Keep only rooms with remaining capacity
  return (rooms ?? []).filter((room) => {
    const cat = Array.isArray(room.category) ? room.category[0] : room.category
    const capacity = cat?.capacity ?? 1
    const booked = bookingCount[room.id] ?? 0
    return booked < capacity
  }).map((room) => {
    const cat = Array.isArray(room.category) ? room.category[0] : room.category
    const capacity = cat?.capacity ?? 1
    const booked = bookingCount[room.id] ?? 0
    return { ...room, spotsRemaining: capacity - booked }
  })
}
