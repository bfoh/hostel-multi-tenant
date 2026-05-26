import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'

interface CreateBillBody {
  supplier_id?:       string  // optional FK; vendor_name still required for free-text capture
  vendor_name:        string
  vendor_contact?:    string
  bill_number?:       string
  bill_date:          string  // YYYY-MM-DD
  due_date:           string  // YYYY-MM-DD
  category:           string
  description:        string
  amount:             number  // pesewas in BASE currency (GHS)
  currency_code?:     string  // ISO 4217; default 'GHS'
  original_amount?:   number  // pesewas in original currency (only for non-GHS)
  fx_rate_used?:      number  // rate applied at capture (only for non-GHS)
  expense_account_id?:string
  notes?:             string
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const tenantId = (await headers()).get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  let body: CreateBillBody
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.vendor_name?.trim()) return NextResponse.json({ error: 'Vendor name required' }, { status: 400 })
  if (!body.description?.trim()) return NextResponse.json({ error: 'Description required' }, { status: 400 })
  if (!body.bill_date || !body.due_date) return NextResponse.json({ error: 'Dates required' }, { status: 400 })
  if (!Number.isInteger(body.amount) || body.amount <= 0) {
    return NextResponse.json({ error: 'Amount must be positive integer pesewas' }, { status: 400 })
  }

  const currency = body.currency_code?.trim().toUpperCase() || 'GHS'
  if (!/^[A-Z]{3,4}$/.test(currency)) {
    return NextResponse.json({ error: 'currency_code must be 3–4 letters (ISO 4217)' }, { status: 400 })
  }
  if (currency !== 'GHS') {
    if (!Number.isInteger(body.original_amount) || (body.original_amount ?? 0) <= 0) {
      return NextResponse.json({ error: 'original_amount required for non-GHS bills' }, { status: 400 })
    }
    if (!Number.isFinite(body.fx_rate_used) || (body.fx_rate_used ?? 0) <= 0) {
      return NextResponse.json({ error: 'fx_rate_used required for non-GHS bills' }, { status: 400 })
    }
  }

  const admin = await createTenantAdminClientFromHeaders()

  // Verify supplier belongs to tenant if provided
  if (body.supplier_id) {
    const { data: sup } = await (admin as any)
      .from('suppliers')
      .select('id')
      .eq('id', body.supplier_id)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (!sup) return NextResponse.json({ error: 'Supplier does not belong to this tenant' }, { status: 400 })
  }

  const { data, error } = await (admin as any)
    .from('supplier_bills')
    .insert({
      tenant_id:          tenantId,
      supplier_id:        body.supplier_id || null,
      vendor_name:        body.vendor_name.trim(),
      vendor_contact:     body.vendor_contact?.trim() || null,
      bill_number:        body.bill_number?.trim() || null,
      bill_date:          body.bill_date,
      due_date:           body.due_date,
      category:           body.category,
      description:        body.description.trim(),
      amount:             body.amount,
      currency_code:      currency,
      original_amount:    currency === 'GHS' ? null : body.original_amount,
      fx_rate_used:       currency === 'GHS' ? null : body.fx_rate_used,
      expense_account_id: body.expense_account_id || null,
      notes:              body.notes?.trim() || null,
      status:             'draft',
      created_by:         user.id,
    })
    .select('id')
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Failed' }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}
