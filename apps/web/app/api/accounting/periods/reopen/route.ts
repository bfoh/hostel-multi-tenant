import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'

interface ReopenBody {
  year:  number
  month: number
}

/**
 * POST /api/accounting/periods/reopen
 *
 * Reverses a close: deletes the closing journal entry (cascades to its lines)
 * and flips the period row back to 'open'. Subsequent edits to entries in
 * the period are allowed again.
 *
 * NOTE: leaves the accounting_periods row in place so the audit history
 * (closed_at, closed_by, prior close totals) survives.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const tenantId = (await headers()).get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  let body: ReopenBody
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!Number.isInteger(body.year) || !Number.isInteger(body.month)) {
    return NextResponse.json({ error: 'year and month required' }, { status: 400 })
  }

  const admin = await createTenantAdminClientFromHeaders()
  const { data: period } = await (admin as any)
    .from('accounting_periods')
    .select('id, status, closing_entry_id')
    .eq('tenant_id', tenantId)
    .eq('year', body.year)
    .eq('month', body.month)
    .maybeSingle()
  if (!period) return NextResponse.json({ error: 'Period not found' }, { status: 404 })
  if (period.status === 'open') return NextResponse.json({ error: 'Period is already open' }, { status: 400 })

  // Flip status to open FIRST — otherwise the journal_lines period-guard
  // trigger (migration 084) would block the cascade delete on the closing
  // entry's lines.
  const { error: flipErr } = await (admin as any)
    .from('accounting_periods')
    .update({
      status:           'open',
      closing_entry_id: null,
      net_profit:       null,
      revenue_total:    null,
      expense_total:    null,
    })
    .eq('id', period.id)
    .eq('tenant_id', tenantId)
  if (flipErr) return NextResponse.json({ error: flipErr.message }, { status: 500 })

  // Now delete the closing entry (cascades lines)
  if (period.closing_entry_id) {
    const { error: delErr } = await (admin as any)
      .from('journal_entries')
      .delete()
      .eq('id', period.closing_entry_id)
      .eq('tenant_id', tenantId)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
