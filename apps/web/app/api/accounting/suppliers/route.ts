import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'

interface CreateBody {
  name:                       string
  contact_name?:              string
  phone?:                     string
  email?:                     string
  address?:                   string
  tin?:                       string
  payment_terms_days?:        number
  default_expense_account_id?:string
  default_currency?:          string
  notes?:                     string
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const tenantId = (await headers()).get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  let body: CreateBody
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  if (body.payment_terms_days !== undefined && (!Number.isInteger(body.payment_terms_days) || body.payment_terms_days < 0)) {
    return NextResponse.json({ error: 'payment_terms_days must be a non-negative integer' }, { status: 400 })
  }
  const currency = (body.default_currency ?? 'GHS').toUpperCase()
  if (!/^[A-Z]{3,4}$/.test(currency)) {
    return NextResponse.json({ error: 'default_currency must be ISO 4217' }, { status: 400 })
  }

  const admin = await createTenantAdminClientFromHeaders()
  const { data, error } = await (admin as any)
    .from('suppliers')
    .insert({
      tenant_id:                  tenantId,
      name:                       body.name.trim(),
      contact_name:               body.contact_name?.trim() || null,
      phone:                      body.phone?.trim() || null,
      email:                      body.email?.trim() || null,
      address:                    body.address?.trim() || null,
      tin:                        body.tin?.trim() || null,
      payment_terms_days:         body.payment_terms_days ?? 30,
      default_expense_account_id: body.default_expense_account_id || null,
      default_currency:           currency,
      notes:                      body.notes?.trim() || null,
      created_by:                 user.id,
    })
    .select('id')
    .single()

  if (error || !data) {
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'A supplier with that name already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error?.message ?? 'Failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, id: data.id })
}
