import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { bookingImportRowSchema } from '@/lib/validation/booking-import'

const MAX_ROWS = 500

const bodySchema = z.object({
  rows: z.array(z.unknown()).min(1).max(MAX_ROWS),
})

type RowError = { row: number; message: string }

function generateBookingRef(): string {
  const year = new Date().getFullYear()
  const rand = Math.floor(Math.random() * 900000) + 100000
  return `ABR-${year}-${rand}`
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsedBody = bodySchema.safeParse(body)
  if (!parsedBody.success) {
    const issue = parsedBody.error.issues[0]
    const msg = issue?.code === 'too_big'
      ? `Too many rows. Max ${MAX_ROWS} per import.`
      : 'Invalid request body'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const tenantId = await getServerTenantId()
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 401 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Validate every row via zod up front.
  type ParsedRow = {
    rowIndex: number
    data: z.infer<typeof bookingImportRowSchema>
  }
  const parsedRows: ParsedRow[] = []
  const errors: RowError[] = []

  parsedBody.data.rows.forEach((raw, i) => {
    const result = bookingImportRowSchema.safeParse(raw)
    if (result.success) {
      parsedRows.push({ rowIndex: i + 1, data: result.data })
    } else {
      const first = result.error.issues[0]
      const path = first.path.join('.')
      errors.push({ row: i + 1, message: path ? `${path}: ${first.message}` : first.message })
    }
  })

  if (parsedRows.length === 0) {
    return NextResponse.json({ created: 0, errors, created_refs: [] }, { status: 200 })
  }

  const admin = createAdminClient()

  // ── Resolve occupants in bulk ────────────────────────────────────
  const phones = Array.from(new Set(
    parsedRows.map((p) => p.data.occupant_phone).filter((v): v is string => !!v),
  ))
  const studentIds = Array.from(new Set(
    parsedRows.map((p) => p.data.occupant_student_id).filter((v): v is string => !!v),
  ))

  const phoneMap = new Map<string, string>() // phone -> occupant_id
  const studentIdMap = new Map<string, string>() // student_id -> occupant_id

  if (phones.length) {
    const { data, error } = await admin
      .from('occupants')
      .select('id, phone')
      .eq('tenant_id', tenantId)
      .in('phone', phones)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    for (const r of data ?? []) phoneMap.set(r.phone, r.id)
  }

  if (studentIds.length) {
    const { data, error } = await admin
      .from('occupants')
      .select('id, student_id')
      .eq('tenant_id', tenantId)
      .in('student_id', studentIds)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    for (const r of data ?? []) if (r.student_id) studentIdMap.set(r.student_id, r.id)
  }

  // ── Resolve rooms + capacity in bulk ─────────────────────────────
  const roomNumbers = Array.from(new Set(parsedRows.map((p) => p.data.room_number)))

  type RoomInfo = {
    id: string
    status: string
    base_rate: number
    rate_unit: string
    capacity: number
  }
  const roomMap = new Map<string, RoomInfo>() // room_number -> info

  if (roomNumbers.length) {
    const { data, error } = await admin
      .from('rooms')
      .select('id, room_number, status, category:room_categories(base_rate, rate_unit, capacity)')
      .eq('tenant_id', tenantId)
      .in('room_number', roomNumbers)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    for (const r of data ?? []) {
      const cat = Array.isArray(r.category) ? r.category[0] : r.category
      roomMap.set(r.room_number, {
        id: r.id,
        status: r.status,
        base_rate: cat?.base_rate ?? 0,
        rate_unit: cat?.rate_unit ?? 'semester',
        capacity: cat?.capacity ?? 1,
      })
    }
  }

  // ── Pre-fetch active overlapping bookings for these rooms ────────
  // For simplicity: fetch all active bookings for these rooms across the full date span
  // (min check_in to max check_out across the import). Then per-row we filter overlaps in memory.
  const roomIds = Array.from(new Set(
    Array.from(roomMap.values()).map((r) => r.id),
  ))
  type ExistingBooking = { room_id: string; check_in_date: string; check_out_date: string }
  const existingByRoom = new Map<string, ExistingBooking[]>()

  if (roomIds.length) {
    const allCheckIns = parsedRows.map((p) => p.data.check_in_date)
    const allCheckOuts = parsedRows.map((p) => p.data.check_out_date)
    const minDate = allCheckIns.sort()[0]
    const maxDate = allCheckOuts.sort().slice(-1)[0]

    const { data, error } = await admin
      .from('bookings')
      .select('room_id, check_in_date, check_out_date')
      .eq('tenant_id', tenantId)
      .in('room_id', roomIds)
      .in('status', ['pending_payment', 'confirmed', 'checked_in'])
      .lte('check_in_date', maxDate)
      .gte('check_out_date', minDate)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    for (const b of data ?? []) {
      const arr = existingByRoom.get(b.room_id) ?? []
      arr.push(b)
      existingByRoom.set(b.room_id, arr)
    }
  }

  // ── Build insert payload, applying per-row checks ────────────────
  type InsertPayload = {
    tenant_id: string
    booking_ref: string
    occupant_id: string
    room_id: string
    check_in_date: string
    check_out_date: string
    source: z.infer<typeof bookingImportRowSchema>['source']
    semester: string | null
    academic_year: string | null
    rate_per_unit: number
    rate_unit: string
    total_amount: number
    discount_amount: number
    discount_reason: string | null
    tax_amount: number
    notes: string | null
    status: 'pending_payment'
  }

  const toInsert: { rowIndex: number; payload: InsertPayload; roomNumber: string; roomId: string; capacity: number }[] = []
  const inBatchOverlaps = new Map<string, { check_in_date: string; check_out_date: string }[]>()

  function overlaps(aIn: string, aOut: string, bIn: string, bOut: string): boolean {
    return aIn <= bOut && aOut >= bIn
  }

  for (const p of parsedRows) {
    const row = p.data

    // Resolve occupant
    let occupantId: string | null = null
    if (row.occupant_phone) occupantId = phoneMap.get(row.occupant_phone) ?? null
    if (!occupantId && row.occupant_student_id) occupantId = studentIdMap.get(row.occupant_student_id) ?? null

    if (!occupantId) {
      errors.push({
        row: p.rowIndex,
        message: `Occupant not found (phone=${row.occupant_phone ?? '—'}, student_id=${row.occupant_student_id ?? '—'})`,
      })
      continue
    }

    // Resolve room
    const room = roomMap.get(row.room_number)
    if (!room) {
      errors.push({ row: p.rowIndex, message: `Room "${row.room_number}" not found` })
      continue
    }
    if (room.status === 'maintenance' || room.status === 'blocked') {
      errors.push({ row: p.rowIndex, message: `Room "${row.room_number}" is ${room.status}` })
      continue
    }

    // Capacity check: existing bookings + in-batch
    const existing = existingByRoom.get(room.id) ?? []
    const existingOverlap = existing.filter((b) =>
      overlaps(b.check_in_date, b.check_out_date, row.check_in_date, row.check_out_date),
    ).length

    const inBatch = inBatchOverlaps.get(room.id) ?? []
    const batchOverlap = inBatch.filter((b) =>
      overlaps(b.check_in_date, b.check_out_date, row.check_in_date, row.check_out_date),
    ).length

    if (existingOverlap + batchOverlap >= room.capacity) {
      errors.push({
        row: p.rowIndex,
        message: `Room "${row.room_number}" full for ${row.check_in_date} → ${row.check_out_date}`,
      })
      continue
    }

    inBatch.push({ check_in_date: row.check_in_date, check_out_date: row.check_out_date })
    inBatchOverlaps.set(room.id, inBatch)

    toInsert.push({
      rowIndex: p.rowIndex,
      roomId: room.id,
      roomNumber: row.room_number,
      capacity: room.capacity,
      payload: {
        tenant_id:       tenantId,
        booking_ref:     generateBookingRef(),
        occupant_id:     occupantId,
        room_id:         room.id,
        check_in_date:   row.check_in_date,
        check_out_date:  row.check_out_date,
        source:          row.source,
        semester:        row.semester ?? null,
        academic_year:   row.academic_year ?? null,
        rate_per_unit:   room.base_rate,
        rate_unit:       room.rate_unit,
        total_amount:    room.base_rate,
        discount_amount: row.discount_amount,
        discount_reason: row.discount_reason ?? null,
        tax_amount:      0,
        notes:           row.notes ?? null,
        status:          'pending_payment',
      },
    })
  }

  if (toInsert.length === 0) {
    return NextResponse.json({ created: 0, errors, created_refs: [] }, { status: 200 })
  }

  // ── Insert one-by-one (each may update room status) ──────────────
  // Bulk insert is possible but room status updates per row are simpler sequential.
  // 500 rows still completes in seconds.
  const createdRefs: string[] = []

  for (const item of toInsert) {
    const { data: inserted, error } = await admin
      .from('bookings')
      .insert(item.payload)
      .select('id, booking_ref')
      .single()

    if (error) {
      const msg = error.code === '23P01'
        ? `Room "${item.roomNumber}" already booked for those dates`
        : error.message
      errors.push({ row: item.rowIndex, message: msg })
      continue
    }

    createdRefs.push(inserted.booking_ref)

    // Update room status based on current active count
    const { count } = await admin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', item.roomId)
      .in('status', ['pending_payment', 'confirmed', 'checked_in'])

    const newStatus = (count ?? 0) >= item.capacity ? 'occupied' : 'reserved'
    await admin.from('rooms').update({ status: newStatus }).eq('id', item.roomId)
  }

  return NextResponse.json(
    { created: createdRefs.length, errors, created_refs: createdRefs },
    { status: 200 },
  )
}
