import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTrialBalance } from '@/lib/data/accounting'

interface CloseBody {
  year:   number
  month:  number   // 1..12
  notes?: string
}

/**
 * POST /api/accounting/periods/close
 *
 * Closes the given period:
 *   1. Verifies the period is not already closed
 *   2. Reads trial balance for the period (revenue + expense)
 *   3. Posts a single closing journal entry that
 *        DR each revenue account by its credit balance
 *        CR each expense account by its debit balance
 *        and plugs the net profit/loss to 3100 Retained Earnings
 *   4. Inserts the accounting_periods row with status='closed' so the
 *      trigger added in migration 082 blocks any further edits
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const tenantId = (await headers()).get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  let body: CloseBody
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!Number.isInteger(body.year)  || body.year < 2000 || body.year > 2100) {
    return NextResponse.json({ error: 'year out of range' }, { status: 400 })
  }
  if (!Number.isInteger(body.month) || body.month < 1 || body.month > 12) {
    return NextResponse.json({ error: 'month must be 1..12' }, { status: 400 })
  }

  const mm = String(body.month).padStart(2, '0')
  const dayMax = new Date(body.year, body.month, 0).getDate()
  const periodStart = `${body.year}-${mm}-01`
  const periodEnd   = `${body.year}-${mm}-${String(dayMax).padStart(2, '0')}`

  // Don't allow closing future periods
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (new Date(periodEnd) > today) {
    return NextResponse.json({ error: 'Cannot close a future period' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Already closed?
  const { data: existing } = await (admin as any)
    .from('accounting_periods')
    .select('id, status')
    .eq('tenant_id', tenantId)
    .eq('year', body.year)
    .eq('month', body.month)
    .maybeSingle()
  if (existing?.status === 'closed') {
    return NextResponse.json({ error: 'Period is already closed' }, { status: 400 })
  }

  // Resolve retained earnings account
  const { data: reAcct } = await (admin as any)
    .from('chart_of_accounts').select('id').eq('tenant_id', tenantId).eq('code', '3100').single()
  if (!reAcct) return NextResponse.json({ error: 'Retained Earnings account (3100) missing from chart of accounts' }, { status: 500 })

  // Trial balance for the period
  const tb = await getTrialBalance(periodStart, periodEnd)
  const revenues = tb.filter((a) => a.type === 'revenue' && a.balance !== 0)
  const expenses = tb.filter((a) => a.type === 'expense' && a.balance !== 0)

  const totalRevenue  = revenues.reduce((s, a) => s + a.balance, 0)
  const totalExpense  = expenses.reduce((s, a) => s + a.balance, 0)
  const netProfit     = totalRevenue - totalExpense

  if (revenues.length === 0 && expenses.length === 0) {
    // Still record the close row so the trigger blocks future edits
    const { error: insErr } = await (admin as any)
      .from('accounting_periods')
      .insert({
        tenant_id:        tenantId,
        year:             body.year,
        month:            body.month,
        status:           'closed',
        closed_at:        new Date().toISOString(),
        closed_by:        user.id,
        net_profit:       0,
        revenue_total:    0,
        expense_total:    0,
        notes:            body.notes?.trim() || null,
      })
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    return NextResponse.json({ ok: true, netProfit: 0, lines: 0 })
  }

  // Build closing entry lines
  const lines: { account_id: string; debit: number; credit: number }[] = []
  for (const r of revenues) {
    lines.push({ account_id: r.account_id, debit: r.balance, credit: 0 })
  }
  for (const e of expenses) {
    lines.push({ account_id: e.account_id, debit: 0, credit: e.balance })
  }
  // Plug to retained earnings
  if (netProfit > 0) {
    lines.push({ account_id: reAcct.id, debit: 0, credit: netProfit })
  } else if (netProfit < 0) {
    lines.push({ account_id: reAcct.id, debit: Math.abs(netProfit), credit: 0 })
  }

  // Sanity check
  const totalDebit  = lines.reduce((s, l) => s + l.debit,  0)
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
  if (totalDebit !== totalCredit) {
    return NextResponse.json({ error: `Closing entry out of balance: D=${totalDebit} C=${totalCredit}` }, { status: 500 })
  }

  // Post journal (period still open here — trigger lets it through)
  const { data: entry, error: entryErr } = await (admin as any)
    .from('journal_entries')
    .insert({
      tenant_id:   tenantId,
      entry_date:  periodEnd,
      reference:   `CLOSE-${body.year}-${mm}`,
      description: `Closing entry — ${new Date(body.year, body.month - 1, 1).toLocaleDateString('en-GH', { month: 'long', year: 'numeric' })}`,
      source:      'manual',
      posted_by:   user.id,
    })
    .select('id')
    .single()
  if (entryErr || !entry) return NextResponse.json({ error: entryErr?.message ?? 'Failed to create closing entry' }, { status: 500 })

  const lineRows = lines.map((l) => ({
    entry_id:   entry.id,
    tenant_id:  tenantId,
    account_id: l.account_id,
    debit:      l.debit,
    credit:     l.credit,
  }))
  const { error: linesErr } = await (admin as any)
    .from('journal_lines')
    .insert(lineRows)
  if (linesErr) {
    await (admin as any).from('journal_entries').delete().eq('id', entry.id)
    return NextResponse.json({ error: linesErr.message }, { status: 500 })
  }

  // Upsert the period row (closed)
  const { error: periodErr } = existing
    ? await (admin as any).from('accounting_periods').update({
        status:           'closed',
        closed_at:        new Date().toISOString(),
        closed_by:        user.id,
        closing_entry_id: entry.id,
        net_profit:       netProfit,
        revenue_total:    totalRevenue,
        expense_total:    totalExpense,
        notes:            body.notes?.trim() || null,
      }).eq('id', existing.id)
    : await (admin as any).from('accounting_periods').insert({
        tenant_id:        tenantId,
        year:             body.year,
        month:            body.month,
        status:           'closed',
        closed_at:        new Date().toISOString(),
        closed_by:        user.id,
        closing_entry_id: entry.id,
        net_profit:       netProfit,
        revenue_total:    totalRevenue,
        expense_total:    totalExpense,
        notes:            body.notes?.trim() || null,
      })
  if (periodErr) return NextResponse.json({ error: periodErr.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    entry_id: entry.id,
    netProfit,
    lines: lines.length,
    revenueAccounts: revenues.length,
    expenseAccounts: expenses.length,
  })
}
