import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { occupantSchema, type OccupantInput } from '@/lib/validation/occupant'

type OccupantInsert = OccupantInput & { tenant_id: string }

const MAX_ROWS = 1000
const CHUNK_SIZE = 100

const bodySchema = z.object({
  rows: z.array(z.unknown()).min(1).max(MAX_ROWS),
})

type RowError = { row: number; message: string }

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

  // Validate every row up front. Track row index (1-based for user display, where row 1 is first data row).
  const valid: { rowIndex: number; data: OccupantInsert }[] = []
  const errors: RowError[] = []

  parsedBody.data.rows.forEach((raw, i) => {
    const result = occupantSchema.safeParse(raw)
    if (result.success) {
      valid.push({ rowIndex: i + 1, data: { ...result.data, tenant_id: tenantId } as OccupantInsert })
    } else {
      const first = result.error.issues[0]
      const path = first.path.join('.')
      errors.push({ row: i + 1, message: path ? `${path}: ${first.message}` : first.message })
    }
  })

  if (valid.length === 0) {
    return NextResponse.json({ created: 0, errors, created_ids: [] }, { status: 200 })
  }

  // Deduplicate within the file by phone (keep first occurrence; flag rest as errors).
  const seenPhones = new Set<string>()
  const dedupedValid: typeof valid = []
  for (const v of valid) {
    const phone = String(v.data.phone)
    if (seenPhones.has(phone)) {
      errors.push({ row: v.rowIndex, message: `Duplicate phone "${phone}" in file` })
      continue
    }
    seenPhones.add(phone)
    dedupedValid.push(v)
  }

  const admin = await createTenantAdminClientFromHeaders()

  // Cross-check phones already in tenant.
  const phoneList = dedupedValid.map((v) => String(v.data.phone))
  if (phoneList.length) {
    const { data: existing, error: lookupErr } = await admin
      .from('occupants')
      .select('phone')
      .eq('tenant_id', tenantId)
      .in('phone', phoneList)

    if (lookupErr) {
      return NextResponse.json({ error: lookupErr.message }, { status: 500 })
    }

    const taken = new Set((existing ?? []).map((r: { phone: string }) => r.phone))
    if (taken.size) {
      for (let i = dedupedValid.length - 1; i >= 0; i--) {
        const phone = String(dedupedValid[i].data.phone)
        if (taken.has(phone)) {
          errors.push({ row: dedupedValid[i].rowIndex, message: `Phone "${phone}" already exists` })
          dedupedValid.splice(i, 1)
        }
      }
    }
  }

  const createdIds: string[] = []

  for (let start = 0; start < dedupedValid.length; start += CHUNK_SIZE) {
    const chunk = dedupedValid.slice(start, start + CHUNK_SIZE)
    const payload = chunk.map((c) => c.data)

    const { data: inserted, error } = await admin
      .from('occupants')
      .insert(payload)
      .select('id')

    if (error) {
      // Whole chunk failed — re-try per row to isolate.
      for (const c of chunk) {
        const { data: one, error: oneErr } = await admin
          .from('occupants')
          .insert(c.data)
          .select('id')
          .single()
        if (oneErr) {
          errors.push({ row: c.rowIndex, message: oneErr.message })
        } else if (one) {
          createdIds.push(one.id)
        }
      }
    } else if (inserted) {
      for (const r of inserted) createdIds.push(r.id)
    }
  }

  return NextResponse.json(
    { created: createdIds.length, errors, created_ids: createdIds },
    { status: 200 },
  )
}
