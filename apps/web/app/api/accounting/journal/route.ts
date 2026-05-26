import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'

interface InputLine {
  account_id:  string
  side:        'debit' | 'credit'
  amount:      number   // pesewas
  description?: string
}

interface InputBody {
  entry_date:  string  // YYYY-MM-DD
  description: string
  reference?:  string
  lines:       InputLine[]
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const tenantId = (await headers()).get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  let body: InputBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.entry_date || !/^\d{4}-\d{2}-\d{2}$/.test(body.entry_date)) {
    return NextResponse.json({ error: 'Invalid entry_date (YYYY-MM-DD)' }, { status: 400 })
  }
  if (!body.description?.trim()) {
    return NextResponse.json({ error: 'Description required' }, { status: 400 })
  }
  if (!Array.isArray(body.lines) || body.lines.length < 2) {
    return NextResponse.json({ error: 'At least 2 lines required' }, { status: 400 })
  }

  let totalDebit  = 0
  let totalCredit = 0
  for (const [i, line] of body.lines.entries()) {
    if (!line.account_id) {
      return NextResponse.json({ error: `Line ${i + 1}: account required` }, { status: 400 })
    }
    if (!Number.isInteger(line.amount) || line.amount <= 0) {
      return NextResponse.json({ error: `Line ${i + 1}: amount must be a positive integer (pesewas)` }, { status: 400 })
    }
    if (line.side !== 'debit' && line.side !== 'credit') {
      return NextResponse.json({ error: `Line ${i + 1}: side must be debit or credit` }, { status: 400 })
    }
    if (line.side === 'debit')  totalDebit  += line.amount
    if (line.side === 'credit') totalCredit += line.amount
  }

  if (totalDebit !== totalCredit) {
    return NextResponse.json({
      error: `Debits (${totalDebit}) must equal credits (${totalCredit})`,
    }, { status: 400 })
  }

  const admin = await createTenantAdminClientFromHeaders()

  // Verify all account IDs belong to this tenant
  const accountIds = Array.from(new Set(body.lines.map((l) => l.account_id)))
  const { data: accounts } = await (admin as any)
    .from('chart_of_accounts')
    .select('id')
    .eq('tenant_id', tenantId)
    .in('id', accountIds)
  if (!accounts || accounts.length !== accountIds.length) {
    return NextResponse.json({ error: 'One or more accounts do not belong to this tenant' }, { status: 400 })
  }

  // Insert header
  const { data: entry, error: entryErr } = await (admin as any)
    .from('journal_entries')
    .insert({
      tenant_id:   tenantId,
      entry_date:  body.entry_date,
      description: body.description.trim(),
      reference:   body.reference?.trim() || null,
      source:      'manual',
      posted_by:   user.id,
    })
    .select('id')
    .single()

  if (entryErr || !entry) {
    return NextResponse.json({ error: entryErr?.message ?? 'Failed to create entry' }, { status: 500 })
  }

  // Insert lines
  const lineRows = body.lines.map((l) => ({
    entry_id:    entry.id,
    tenant_id:   tenantId,
    account_id:  l.account_id,
    description: l.description?.trim() || null,
    debit:       l.side === 'debit'  ? l.amount : 0,
    credit:      l.side === 'credit' ? l.amount : 0,
  }))

  const { error: linesErr } = await (admin as any)
    .from('journal_lines')
    .insert(lineRows)

  if (linesErr) {
    // Rollback header
    await (admin as any).from('journal_entries').delete().eq('id', entry.id)
    return NextResponse.json({ error: linesErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, entry_id: entry.id })
}
