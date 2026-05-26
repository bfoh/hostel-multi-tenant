import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'

interface UpsertBudgetBody {
  account_id: string
  year:       number
  month:      number   // 1..12
  amount:     number   // pesewas (>= 0)
  notes?:     string
}

/**
 * POST /api/accounting/budgets
 * Upserts a budget row keyed on (tenant, account, year, month).
 * Sending amount = 0 deletes the row to keep the table small.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const tenantId = (await headers()).get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  let body: UpsertBudgetBody
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.account_id) return NextResponse.json({ error: 'account_id required' }, { status: 400 })
  if (!Number.isInteger(body.year) || body.year < 2000 || body.year > 2100) {
    return NextResponse.json({ error: 'year out of range' }, { status: 400 })
  }
  if (!Number.isInteger(body.month) || body.month < 1 || body.month > 12) {
    return NextResponse.json({ error: 'month must be 1..12' }, { status: 400 })
  }
  if (!Number.isInteger(body.amount) || body.amount < 0) {
    return NextResponse.json({ error: 'amount must be non-negative integer pesewas' }, { status: 400 })
  }

  const admin = await createTenantAdminClientFromHeaders()

  // Verify account belongs to tenant
  const { data: account } = await (admin as any)
    .from('chart_of_accounts')
    .select('id')
    .eq('id', body.account_id)
    .eq('tenant_id', tenantId)
    .single()
  if (!account) return NextResponse.json({ error: 'Account not in tenant' }, { status: 400 })

  if (body.amount === 0) {
    const { error } = await (admin as any)
      .from('account_budgets')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('account_id', body.account_id)
      .eq('year', body.year)
      .eq('month', body.month)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, deleted: true })
  }

  const { error } = await (admin as any)
    .from('account_budgets')
    .upsert({
      tenant_id:  tenantId,
      account_id: body.account_id,
      year:       body.year,
      month:      body.month,
      amount:     body.amount,
      notes:      body.notes?.trim() || null,
      created_by: user.id,
    }, { onConflict: 'tenant_id,account_id,year,month' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
