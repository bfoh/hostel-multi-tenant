import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'

interface CreateBody {
  name:          string
  description:   string
  frequency:     'monthly' | 'quarterly' | 'yearly'
  day_of_month:  number
  next_run_date: string
  lines:         Array<{ account_id: string; side: 'debit' | 'credit'; amount: number; description?: string }>
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const tenantId = (await headers()).get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  let body: CreateBody
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.name?.trim())        return NextResponse.json({ error: 'name required' }, { status: 400 })
  if (!body.description?.trim()) return NextResponse.json({ error: 'description required' }, { status: 400 })
  if (!Array.isArray(body.lines) || body.lines.length < 2) {
    return NextResponse.json({ error: 'At least 2 lines required' }, { status: 400 })
  }

  let totalDebit  = 0
  let totalCredit = 0
  for (const [i, l] of body.lines.entries()) {
    if (!l.account_id) return NextResponse.json({ error: `Line ${i + 1}: account required` }, { status: 400 })
    if (!Number.isInteger(l.amount) || l.amount <= 0) {
      return NextResponse.json({ error: `Line ${i + 1}: amount must be positive integer pesewas` }, { status: 400 })
    }
    if (l.side !== 'debit' && l.side !== 'credit') {
      return NextResponse.json({ error: `Line ${i + 1}: side must be debit|credit` }, { status: 400 })
    }
    if (l.side === 'debit')  totalDebit  += l.amount
    if (l.side === 'credit') totalCredit += l.amount
  }
  if (totalDebit !== totalCredit) {
    return NextResponse.json({ error: `Debits (${totalDebit}) must equal credits (${totalCredit})` }, { status: 400 })
  }

  const admin = await createTenantAdminClientFromHeaders()

  // Verify accounts belong to tenant
  const accountIds = Array.from(new Set(body.lines.map((l) => l.account_id)))
  const { data: accounts } = await (admin as any)
    .from('chart_of_accounts')
    .select('id')
    .eq('tenant_id', tenantId)
    .in('id', accountIds)
  if (!accounts || accounts.length !== accountIds.length) {
    return NextResponse.json({ error: 'One or more accounts do not belong to this tenant' }, { status: 400 })
  }

  const { data, error } = await (admin as any)
    .from('recurring_journals')
    .insert({
      tenant_id:     tenantId,
      name:          body.name.trim(),
      description:   body.description.trim(),
      frequency:     body.frequency,
      day_of_month:  body.day_of_month,
      next_run_date: body.next_run_date,
      lines:         body.lines,
      created_by:    user.id,
    })
    .select('id')
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Failed' }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}
