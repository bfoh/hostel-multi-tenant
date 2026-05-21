import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

interface RoomRow {
  room_number: string
  category_name: string
  floor?: string
  block?: string
  status?: string
  notes?: string
}

const VALID_STATUSES = ['available', 'occupied', 'reserved', 'maintenance', 'inactive']

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase())
  return lines.slice(1).map((line) => {
    const vals = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''))
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']))
  })
}

// POST /api/rooms/import  body: { rows: RoomRow[], dry_run?: boolean }
// Also accepts multipart with a CSV file
export async function POST(req: NextRequest) {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contentType = req.headers.get('content-type') ?? ''
  let rawRows: Record<string, string>[] = []
  let dryRun = false

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    const text = await file.text()
    rawRows = parseCsv(text)
    dryRun = form.get('dry_run') === 'true'
  } else {
    const body = await req.json().catch(() => null)
    if (!body?.rows) return NextResponse.json({ error: 'rows required' }, { status: 400 })
    rawRows = body.rows
    dryRun = !!body.dry_run
  }

  if (rawRows.length === 0) return NextResponse.json({ error: 'No rows found' }, { status: 400 })
  if (rawRows.length > 500) return NextResponse.json({ error: 'Maximum 500 rows per import' }, { status: 400 })

  const supabase = createAdminClient()

  // Load categories for this tenant
  const { data: categories } = await supabase
    .from('room_categories')
    .select('id, name')
    .eq('tenant_id', tenantId)

  const catMap = new Map((categories ?? []).map((c) => [c.name.toLowerCase().trim(), c.id]))

  // Validate
  const errors: { row: number; message: string }[] = []
  const valid: { tenant_id: string; category_id: string; room_number: string; floor: number | null; block: string | null; status: string; notes: string | null }[] = []

  rawRows.forEach((row, i) => {
    const rowNum = i + 2 // 1-based + header
    const roomNumber = row['room_number']?.trim()
    const categoryName = row['category_name']?.trim() ?? row['category']?.trim()

    if (!roomNumber) { errors.push({ row: rowNum, message: 'room_number is required' }); return }
    if (!categoryName) { errors.push({ row: rowNum, message: 'category_name is required' }); return }

    const categoryId = catMap.get(categoryName.toLowerCase())
    if (!categoryId) { errors.push({ row: rowNum, message: `Category "${categoryName}" not found` }); return }

    const status = row['status']?.trim() || 'available'
    if (!VALID_STATUSES.includes(status)) { errors.push({ row: rowNum, message: `Invalid status "${status}"` }); return }

    const floorVal = row['floor']?.trim()
    const floor = floorVal ? parseInt(floorVal, 10) : null
    if (floorVal && isNaN(floor!)) { errors.push({ row: rowNum, message: `Invalid floor "${floorVal}"` }); return }

    valid.push({
      tenant_id:   tenantId,
      category_id: categoryId,
      room_number: roomNumber,
      floor:       floor,
      block:       row['block']?.trim() || '',
      status,
      notes:       row['notes']?.trim() || null,
    })
  })

  if (errors.length > 0) {
    return NextResponse.json({ errors, imported: 0, skipped: errors.length }, { status: 422 })
  }

  // Pre-dedupe in-batch on (block, room_number) so two rows targeting
  // the same conflict key don't blow Postgres' "cannot affect row a
  // second time" guard. Last write wins.
  const seen = new Map<string, typeof valid[number]>()
  const dupes: string[] = []
  for (const r of valid) {
    const key = `${r.block}::${r.room_number}`
    if (seen.has(key)) dupes.push(`${r.block || '(no block)'} ${r.room_number}`)
    seen.set(key, r)
  }
  const deduped = Array.from(seen.values())

  if (dryRun) {
    return NextResponse.json({
      dry_run:   true,
      valid:     deduped.length,
      duplicates:dupes,
      rows:      deduped,
    })
  }

  // Upsert on (tenant_id, block, room_number) — block included so multi-block
  // hostels with reused room numbers (Block A 1..10, Block B 1..10) work.
  const { data, error } = await (supabase.from('rooms') as any)
    .upsert(deduped, { onConflict: 'tenant_id,block,room_number' })
    .select('id, room_number')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    imported:  data?.length ?? 0,
    duplicates:dupes,
    errors:    [],
  }, { status: 201 })
}
