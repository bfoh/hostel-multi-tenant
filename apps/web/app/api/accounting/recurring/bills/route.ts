import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface CreateBody {
  supplier_id?:       string
  vendor_name:        string
  description:        string
  category:           string
  amount:             number     // pesewas
  expense_account_id?:string
  frequency:          'monthly' | 'quarterly' | 'yearly'
  day_of_month:       number     // 1..31
  due_day_offset:     number     // days from generation to due date
  next_run_date:      string     // YYYY-MM-DD
  notes?:             string
}

const VALID_FREQ = new Set(['monthly', 'quarterly', 'yearly'])
const VALID_CAT = new Set([
  'utilities','repairs','salaries','supplies','maintenance',
  'marketing','insurance','rent','equipment','other',
])

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const tenantId = (await headers()).get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  let body: CreateBody
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.vendor_name?.trim())   return NextResponse.json({ error: 'vendor_name required' }, { status: 400 })
  if (!body.description?.trim())   return NextResponse.json({ error: 'description required' }, { status: 400 })
  if (!VALID_CAT.has(body.category)) return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  if (!Number.isInteger(body.amount) || body.amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive integer (pesewas)' }, { status: 400 })
  }
  if (!VALID_FREQ.has(body.frequency)) return NextResponse.json({ error: 'Invalid frequency' }, { status: 400 })
  if (!Number.isInteger(body.day_of_month) || body.day_of_month < 1 || body.day_of_month > 31) {
    return NextResponse.json({ error: 'day_of_month must be 1..31' }, { status: 400 })
  }
  if (!Number.isInteger(body.due_day_offset) || body.due_day_offset < 0) {
    return NextResponse.json({ error: 'due_day_offset must be >= 0' }, { status: 400 })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.next_run_date)) {
    return NextResponse.json({ error: 'next_run_date required (YYYY-MM-DD)' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await (admin as any)
    .from('recurring_bills')
    .insert({
      tenant_id:          tenantId,
      supplier_id:        body.supplier_id || null,
      vendor_name:        body.vendor_name.trim(),
      description:        body.description.trim(),
      category:           body.category,
      amount:             body.amount,
      expense_account_id: body.expense_account_id || null,
      frequency:          body.frequency,
      day_of_month:       body.day_of_month,
      due_day_offset:     body.due_day_offset,
      next_run_date:      body.next_run_date,
      notes:              body.notes?.trim() || null,
      created_by:         user.id,
    })
    .select('id')
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Failed' }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}
