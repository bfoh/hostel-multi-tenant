import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'

interface UpsertBody {
  currency_code:  string
  rate_to_base:   number   // 1 unit foreign = rate_to_base GHS
  as_of_date:     string   // YYYY-MM-DD
  source?:        string
  notes?:         string
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const tenantId = (await headers()).get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  let body: UpsertBody
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const code = body.currency_code?.trim().toUpperCase()
  if (!code || !/^[A-Z]{3,4}$/.test(code)) {
    return NextResponse.json({ error: 'currency_code must be 3–4 letters (ISO 4217)' }, { status: 400 })
  }
  if (code === 'GHS') {
    return NextResponse.json({ error: 'Base currency (GHS) does not need an FX rate' }, { status: 400 })
  }
  if (!body.as_of_date || !/^\d{4}-\d{2}-\d{2}$/.test(body.as_of_date)) {
    return NextResponse.json({ error: 'as_of_date required (YYYY-MM-DD)' }, { status: 400 })
  }
  if (!Number.isFinite(body.rate_to_base) || body.rate_to_base <= 0) {
    return NextResponse.json({ error: 'rate_to_base must be > 0' }, { status: 400 })
  }

  const admin = await createTenantAdminClientFromHeaders()
  const { error } = await (admin as any)
    .from('fx_rates')
    .upsert({
      tenant_id:     tenantId,
      currency_code: code,
      rate_to_base:  body.rate_to_base,
      as_of_date:    body.as_of_date,
      source:        body.source?.trim() || null,
      notes:         body.notes?.trim() || null,
      created_by:    user.id,
    }, { onConflict: 'tenant_id,currency_code,as_of_date' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const tenantId = (await headers()).get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const admin = await createTenantAdminClientFromHeaders()
  const { error } = await (admin as any)
    .from('fx_rates')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
