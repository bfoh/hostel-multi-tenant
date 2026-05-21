import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface UpdateBody {
  name?:                      string
  contact_name?:              string | null
  phone?:                     string | null
  email?:                     string | null
  address?:                   string | null
  tin?:                       string | null
  payment_terms_days?:        number
  default_expense_account_id?:string | null
  default_currency?:          string
  notes?:                     string | null
  is_active?:                 boolean
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const tenantId = (await headers()).get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const { id } = await params
  let body: UpdateBody
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const update: Record<string, any> = {}
  if (body.name !== undefined) {
    if (!body.name.trim()) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
    update.name = body.name.trim()
  }
  for (const k of ['contact_name', 'phone', 'email', 'address', 'tin', 'notes'] as const) {
    if (body[k] !== undefined) update[k] = body[k] === null ? null : String(body[k]).trim() || null
  }
  if (body.payment_terms_days !== undefined) {
    if (!Number.isInteger(body.payment_terms_days) || body.payment_terms_days < 0) {
      return NextResponse.json({ error: 'payment_terms_days must be a non-negative integer' }, { status: 400 })
    }
    update.payment_terms_days = body.payment_terms_days
  }
  if (body.default_expense_account_id !== undefined) update.default_expense_account_id = body.default_expense_account_id || null
  if (body.default_currency !== undefined) {
    const c = body.default_currency.toUpperCase()
    if (!/^[A-Z]{3,4}$/.test(c)) return NextResponse.json({ error: 'default_currency must be ISO 4217' }, { status: 400 })
    update.default_currency = c
  }
  if (body.is_active !== undefined) update.is_active = body.is_active

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await (admin as any)
    .from('suppliers')
    .update(update)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
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

  // Refuse delete if linked to any bill — soft-deactivate instead
  const { data: linked } = await (admin as any)
    .from('supplier_bills')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('supplier_id', id)
    .limit(1)
  if (linked && linked.length > 0) {
    return NextResponse.json({
      error: 'Supplier has bills attached — set is_active=false instead of deleting',
    }, { status: 400 })
  }

  const { data, error } = await (admin as any)
    .from('suppliers')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
