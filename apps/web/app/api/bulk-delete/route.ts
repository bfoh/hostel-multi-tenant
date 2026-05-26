import { NextResponse, type NextRequest } from 'next/server'
import { getServerTenantId } from '@/lib/auth/tenant'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'

/**
 * POST /api/bulk-delete
 *
 * Generic, tenant-scoped batch delete for list pages. Body:
 *   { resource: <key>, ids: string[] }
 *
 * Each resource declares its table and an optional `guard` that pre-checks
 * which ids cannot be deleted (e.g. has dependent records) — those are
 * skipped and returned in `blockedRows` rather than failing the whole batch.
 */

type GuardResult = { blocked: Map<string, string> } // id → reason

interface ResourceDef {
  table: string
  /** Returns ids that must NOT be deleted, mapped to a human reason. */
  guard?: (admin: any, tenantId: string, ids: string[]) => Promise<Map<string, string>>
}

/** Generic guard: block ids that appear as a FK in another table's column. */
function fkGuard(refTable: string, refColumn: string, reason: string) {
  return async (admin: any, tenantId: string, ids: string[]): Promise<Map<string, string>> => {
    const { data } = await admin
      .from(refTable)
      .select(refColumn)
      .eq('tenant_id', tenantId)
      .in(refColumn, ids)
    const blocked = new Map<string, string>()
    for (const row of (data ?? []) as any[]) {
      const v = row[refColumn] as string
      if (v) blocked.set(v, reason)
    }
    return blocked
  }
}

const RESOURCES: Record<string, ResourceDef> = {
  occupants: {
    table: 'occupants',
    guard: fkGuard('bookings', 'occupant_id', 'Has bookings — cancel or remove them first'),
  },
  maintenance_requests: { table: 'maintenance_requests' },
  lost_found:           { table: 'lost_found' },
  assets:               { table: 'assets' },
  suppliers: {
    table: 'suppliers',
    guard: fkGuard('supplier_bills', 'supplier_id', 'Has bills — deactivate instead'),
  },
  expenses:  { table: 'expenses' },
  notices:   { table: 'notices' },
  waiting_list: { table: 'waiting_list' },
  menu_items:   { table: 'menu_items' },
}

export async function POST(req: NextRequest) {
  const tenantId = await getServerTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 401 })

  let body: { resource?: string; ids?: string[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const def = body.resource ? RESOURCES[body.resource] : undefined
  if (!def) return NextResponse.json({ error: 'Unknown resource' }, { status: 400 })
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: 'ids array required' }, { status: 400 })
  }
  if (body.ids.length > 300) {
    return NextResponse.json({ error: 'Maximum 300 rows per bulk delete' }, { status: 400 })
  }

  const admin = await createTenantAdminClientFromHeaders()

  // Pre-check guard
  let blocked = new Map<string, string>()
  if (def.guard) {
    blocked = await def.guard(admin, tenantId, body.ids)
  }
  const deletable = body.ids.filter((id) => !blocked.has(id))

  let deleted = 0
  if (deletable.length > 0) {
    const { data, error } = await (admin as any)
      .from(def.table)
      .delete()
      .eq('tenant_id', tenantId)
      .in('id', deletable)
      .select('id')

    if (error) {
      if (error.code === '23503') {
        return NextResponse.json({
          error: 'Some rows are still referenced by other records and cannot be deleted.',
          detail: (error as any).details ?? error.message,
        }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    deleted = ((data ?? []) as any[]).length
  }

  return NextResponse.json({
    ok: true,
    deleted,
    blocked: blocked.size,
    blockedRows: Array.from(blocked.entries()).map(([id, reason]) => ({ id, reason })),
  })
}
