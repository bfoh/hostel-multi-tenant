import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'

interface PayBillBody {
  amount:         number  // pesewas
  paid_at:        string  // YYYY-MM-DD
  payment_method: 'cash' | 'bank_transfer' | 'momo' | 'card' | 'cheque'
  reference?:     string
  notes?:         string
}

const METHOD_TO_CASH_CODE: Record<string, string> = {
  cash:          '1010',  // Cash on Hand
  bank_transfer: '1020',  // Cash at Bank
  momo:          '1020',
  card:          '1020',
  cheque:        '1020',
}

/**
 * POST /api/accounting/ap/bills/[id]/pay
 *
 * Records a payment against an approved bill and posts:
 *   DR 2010 Accounts Payable amount
 *   CR <cash account>       amount
 *
 * Increments paid_amount and transitions status to 'partial' or 'paid'.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const tenantId = (await headers()).get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const { id } = await params
  let body: PayBillBody
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!Number.isInteger(body.amount) || body.amount <= 0) {
    return NextResponse.json({ error: 'Amount must be positive integer pesewas' }, { status: 400 })
  }
  if (!body.paid_at) return NextResponse.json({ error: 'paid_at required' }, { status: 400 })
  if (!METHOD_TO_CASH_CODE[body.payment_method]) {
    return NextResponse.json({ error: 'Invalid payment_method' }, { status: 400 })
  }

  const admin = await createTenantAdminClientFromHeaders()

  const { data: bill } = await (admin as any)
    .from('supplier_bills')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()
  if (!bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 })

  if (bill.status === 'draft' || bill.status === 'cancelled' || bill.status === 'paid') {
    return NextResponse.json({ error: `Cannot pay a bill in status "${bill.status}"` }, { status: 400 })
  }

  const outstanding = bill.amount - bill.paid_amount
  if (body.amount > outstanding) {
    return NextResponse.json({ error: `Amount exceeds outstanding balance (${outstanding})` }, { status: 400 })
  }

  // Resolve cash + AP accounts
  const cashCode = METHOD_TO_CASH_CODE[body.payment_method]
  const { data: cashAcct } = await (admin as any)
    .from('chart_of_accounts').select('id').eq('tenant_id', tenantId).eq('code', cashCode).single()
  const { data: apAcct } = await (admin as any)
    .from('chart_of_accounts').select('id').eq('tenant_id', tenantId).eq('code', '2010').single()
  if (!cashAcct || !apAcct) {
    return NextResponse.json({ error: 'Cash or AP account not found in COA' }, { status: 500 })
  }

  // Journal: DR AP, CR Cash
  const { data: entry, error: entryErr } = await (admin as any)
    .from('journal_entries')
    .insert({
      tenant_id:   tenantId,
      entry_date:  body.paid_at,
      reference:   body.reference ?? bill.bill_number ?? null,
      description: `AP payment — ${bill.vendor_name}: ${bill.description}`,
      source:      'manual',
      posted_by:   user.id,
    })
    .select('id')
    .single()
  if (entryErr || !entry) return NextResponse.json({ error: entryErr?.message ?? 'Journal failed' }, { status: 500 })

  const { error: linesErr } = await (admin as any)
    .from('journal_lines')
    .insert([
      { entry_id: entry.id, tenant_id: tenantId, account_id: apAcct.id,   debit: body.amount, credit: 0 },
      { entry_id: entry.id, tenant_id: tenantId, account_id: cashAcct.id, debit: 0,           credit: body.amount },
    ])
  if (linesErr) {
    await (admin as any).from('journal_entries').delete().eq('id', entry.id)
    return NextResponse.json({ error: linesErr.message }, { status: 500 })
  }

  // Record payment + update bill
  const newPaidAmount = bill.paid_amount + body.amount
  const newStatus = newPaidAmount >= bill.amount ? 'paid' : 'partial'

  const { error: payErr } = await (admin as any)
    .from('supplier_bill_payments')
    .insert({
      tenant_id:        tenantId,
      bill_id:          id,
      amount:           body.amount,
      paid_at:          body.paid_at,
      payment_method:   body.payment_method,
      reference:        body.reference?.trim() || null,
      notes:            body.notes?.trim() || null,
      journal_entry_id: entry.id,
      created_by:       user.id,
    })
  if (payErr) return NextResponse.json({ error: payErr.message }, { status: 500 })

  await (admin as any)
    .from('supplier_bills')
    .update({ paid_amount: newPaidAmount, status: newStatus })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  return NextResponse.json({ ok: true, status: newStatus, entry_id: entry.id })
}
