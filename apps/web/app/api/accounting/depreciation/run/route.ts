import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeMonthlyDepreciation } from '@/lib/data/depreciation'

interface RunBody {
  year:  number
  month: number  // 1..12
}

/**
 * POST /api/accounting/depreciation/run
 *
 * Posts depreciation for the given month:
 *   1. Computes per-asset monthly amount via straight-line
 *   2. Skips assets that would push net book below salvage
 *   3. Posts a single journal entry — DR 5100 / CR 1510 — for the period total
 *   4. Increments accumulated_depreciation on each asset
 *   5. Records the run in depreciation_runs so the same month can't be re-posted
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const tenantId = (await headers()).get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  let body: RunBody
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!Number.isInteger(body.year)  || body.year < 2000 || body.year > 2100) {
    return NextResponse.json({ error: 'year out of range' }, { status: 400 })
  }
  if (!Number.isInteger(body.month) || body.month < 1 || body.month > 12) {
    return NextResponse.json({ error: 'month must be 1..12' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Refuse if already run
  const { data: existing } = await (admin as any)
    .from('depreciation_runs')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('period_year', body.year)
    .eq('period_month', body.month)
    .maybeSingle()
  if (existing) return NextResponse.json({ error: 'Depreciation already posted for this period' }, { status: 400 })

  // Resolve required GL accounts
  const { data: depExpense } = await (admin as any)
    .from('chart_of_accounts').select('id').eq('tenant_id', tenantId).eq('code', '5100').single()
  const { data: accumDep } = await (admin as any)
    .from('chart_of_accounts').select('id').eq('tenant_id', tenantId).eq('code', '1510').single()
  if (!depExpense || !accumDep) {
    return NextResponse.json({ error: 'Chart of accounts missing 5100 (Depreciation Expense) or 1510 (Accum. Depreciation)' }, { status: 500 })
  }

  // Fetch eligible assets
  const { data: assets } = await (admin as any)
    .from('assets')
    .select('id, purchase_price, salvage_value, useful_life_months, accumulated_depreciation, depreciation_method, declining_factor')
    .eq('tenant_id', tenantId)
    .neq('status', 'disposed')

  const dayMax = new Date(body.year, body.month, 0).getDate()
  const periodEndIso = `${body.year}-${String(body.month).padStart(2, '0')}-${String(dayMax).padStart(2, '0')}`

  type Update = { id: string; newAccumulated: number; amount: number }
  const updates: Update[] = []
  let totalAmount = 0

  for (const a of (assets ?? []) as any[]) {
    const monthly = computeMonthlyDepreciation({
      purchase_price:            a.purchase_price,
      salvage_value:             a.salvage_value,
      useful_life_months:        a.useful_life_months,
      depreciation_method:       a.depreciation_method,
      declining_factor:          a.declining_factor ? Number(a.declining_factor) : 2.0,
      accumulated_depreciation:  a.accumulated_depreciation,
    })
    if (monthly <= 0) continue

    const cost = a.purchase_price ?? 0
    const acc  = a.accumulated_depreciation ?? 0
    const remainingDepreciable = Math.max(0, cost - a.salvage_value - acc)
    if (remainingDepreciable <= 0) continue

    const amount = Math.min(monthly, remainingDepreciable)
    updates.push({ id: a.id, newAccumulated: acc + amount, amount })
    totalAmount += amount
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: 'No assets eligible for depreciation this period' }, { status: 400 })
  }

  // Post journal entry (single header, two lines)
  const { data: entry, error: entryErr } = await (admin as any)
    .from('journal_entries')
    .insert({
      tenant_id:   tenantId,
      entry_date:  periodEndIso,
      reference:   `DEP-${body.year}-${String(body.month).padStart(2, '0')}`,
      description: `Monthly depreciation — ${updates.length} asset${updates.length === 1 ? '' : 's'}`,
      source:      'manual',
      posted_by:   user.id,
    })
    .select('id')
    .single()
  if (entryErr || !entry) return NextResponse.json({ error: entryErr?.message ?? 'Journal failed' }, { status: 500 })

  const { error: linesErr } = await (admin as any)
    .from('journal_lines')
    .insert([
      { entry_id: entry.id, tenant_id: tenantId, account_id: depExpense.id, debit: totalAmount, credit: 0 },
      { entry_id: entry.id, tenant_id: tenantId, account_id: accumDep.id,   debit: 0,           credit: totalAmount },
    ])
  if (linesErr) {
    await (admin as any).from('journal_entries').delete().eq('id', entry.id)
    return NextResponse.json({ error: linesErr.message }, { status: 500 })
  }

  // Update each asset's accumulated_depreciation
  for (const u of updates) {
    await (admin as any)
      .from('assets')
      .update({
        accumulated_depreciation: u.newAccumulated,
        last_depreciated_through: periodEndIso,
      })
      .eq('id', u.id)
      .eq('tenant_id', tenantId)
  }

  // Record run
  const { error: runErr } = await (admin as any)
    .from('depreciation_runs')
    .insert({
      tenant_id:        tenantId,
      period_year:      body.year,
      period_month:     body.month,
      asset_count:      updates.length,
      total_amount:     totalAmount,
      journal_entry_id: entry.id,
      posted_by:        user.id,
    })
  if (runErr) return NextResponse.json({ error: runErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, entry_id: entry.id, asset_count: updates.length, total_amount: totalAmount })
}
