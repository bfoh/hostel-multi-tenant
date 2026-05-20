import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/accounting/ap/bills/[id]/approve
 *
 * Approves a draft bill and posts the accrual journal entry:
 *   DR  <expense_account>   amount
 *   CR  2010 Accounts Payable amount
 *
 * Uses the supplier bill's expense_account_id when set; otherwise falls
 * back to 5050 (Administrative Expenses).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const tenantId = (await headers()).get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const { id } = await params
  const admin = createAdminClient()

  const { data: bill } = await (admin as any)
    .from('supplier_bills')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
  if (bill.status !== 'draft') {
    return NextResponse.json({ error: `Cannot approve a bill in status "${bill.status}"` }, { status: 400 })
  }

  // Resolve accounts
  const { data: apAcct } = await (admin as any)
    .from('chart_of_accounts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('code', '2010')
    .single()
  if (!apAcct) return NextResponse.json({ error: 'Accounts Payable account (2010) not found' }, { status: 500 })

  let expenseAccountId: string | null = bill.expense_account_id
  if (!expenseAccountId) {
    const { data: fallback } = await (admin as any)
      .from('chart_of_accounts')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('code', '5050')
      .single()
    expenseAccountId = fallback?.id ?? null
  }
  if (!expenseAccountId) return NextResponse.json({ error: 'No expense account resolved' }, { status: 500 })

  // Post journal
  const { data: entry, error: entryErr } = await (admin as any)
    .from('journal_entries')
    .insert({
      tenant_id:   tenantId,
      entry_date:  bill.bill_date,
      reference:   bill.bill_number ?? null,
      description: `AP — ${bill.vendor_name}: ${bill.description}`,
      source:      'manual',
      posted_by:   user.id,
    })
    .select('id')
    .single()
  if (entryErr || !entry) return NextResponse.json({ error: entryErr?.message ?? 'Journal failed' }, { status: 500 })

  const { error: linesErr } = await (admin as any)
    .from('journal_lines')
    .insert([
      { entry_id: entry.id, tenant_id: tenantId, account_id: expenseAccountId, debit: bill.amount, credit: 0 },
      { entry_id: entry.id, tenant_id: tenantId, account_id: apAcct.id,        debit: 0,           credit: bill.amount },
    ])
  if (linesErr) {
    await (admin as any).from('journal_entries').delete().eq('id', entry.id)
    return NextResponse.json({ error: linesErr.message }, { status: 500 })
  }

  // Update bill
  const { error: updErr } = await (admin as any)
    .from('supplier_bills')
    .update({
      status:            'approved',
      approved_by:       user.id,
      approved_at:       new Date().toISOString(),
      approval_entry_id: entry.id,
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, entry_id: entry.id })
}
