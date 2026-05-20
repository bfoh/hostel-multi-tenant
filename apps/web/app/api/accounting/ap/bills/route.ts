import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface CreateBillBody {
  vendor_name:        string
  vendor_contact?:    string
  bill_number?:       string
  bill_date:          string  // YYYY-MM-DD
  due_date:           string  // YYYY-MM-DD
  category:           string
  description:        string
  amount:             number  // pesewas
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

  const admin = createAdminClient()
  const { data, error } = await (admin as any)
    .from('supplier_bills')
    .insert({
      tenant_id:          tenantId,
      vendor_name:        body.vendor_name.trim(),
      vendor_contact:     body.vendor_contact?.trim() || null,
      bill_number:        body.bill_number?.trim() || null,
      bill_date:          body.bill_date,
      due_date:           body.due_date,
      category:           body.category,
      description:        body.description.trim(),
      amount:             body.amount,
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
