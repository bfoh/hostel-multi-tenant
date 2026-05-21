import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeNextRunDate } from '@/lib/data/recurring'

/**
 * POST /api/accounting/recurring/generate
 *
 * Fires every active recurring bill + journal whose next_run_date <= today.
 * For each successful generation:
 *   - Bill: inserts a draft supplier_bill linked back via
 *     generated_from_recurring_id, advances last/next_run_date
 *   - Journal: posts a manual journal entry with the stored lines and
 *     stamps generated_from_recurring_id, advances last/next_run_date
 *
 * Safe to call repeatedly — each template only fires once per due date
 * because we advance next_run_date before persisting.
 */
export async function POST(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const tenantId = (await headers()).get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const today = new Date().toISOString().slice(0, 10)
  const admin = createAdminClient()

  const [{ data: dueBills }, { data: dueJournals }] = await Promise.all([
    (admin as any)
      .from('recurring_bills')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .lte('next_run_date', today),
    (admin as any)
      .from('recurring_journals')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .lte('next_run_date', today),
  ])

  let billsGenerated   = 0
  let journalsGenerated = 0
  const errors: string[] = []

  for (const r of (dueBills ?? []) as any[]) {
    const issueDate = r.next_run_date  // post against the scheduled date
    const dueDate = (() => {
      const d = new Date(issueDate)
      d.setDate(d.getDate() + Number(r.due_day_offset))
      return d.toISOString().slice(0, 10)
    })()
    const { error: insErr } = await (admin as any)
      .from('supplier_bills')
      .insert({
        tenant_id:                   tenantId,
        supplier_id:                 r.supplier_id,
        vendor_name:                 r.vendor_name,
        bill_date:                   issueDate,
        due_date:                    dueDate,
        category:                    r.category,
        description:                 r.description,
        amount:                      r.amount,
        currency_code:               'GHS',
        expense_account_id:          r.expense_account_id,
        notes:                       r.notes,
        status:                      'draft',
        created_by:                  user.id,
        generated_from_recurring_id: r.id,
      })
    if (insErr) { errors.push(`bill ${r.id}: ${insErr.message}`); continue }

    const nextRun = computeNextRunDate(new Date(issueDate), r.frequency, r.day_of_month)
    await (admin as any)
      .from('recurring_bills')
      .update({ last_run_date: issueDate, next_run_date: nextRun })
      .eq('id', r.id)
      .eq('tenant_id', tenantId)

    billsGenerated += 1
  }

  for (const r of (dueJournals ?? []) as any[]) {
    const issueDate = r.next_run_date

    // Insert header
    const { data: entry, error: entryErr } = await (admin as any)
      .from('journal_entries')
      .insert({
        tenant_id:                   tenantId,
        entry_date:                  issueDate,
        reference:                   `REC-${r.id.slice(0, 8)}`,
        description:                 r.description,
        source:                      'manual',
        posted_by:                   user.id,
        generated_from_recurring_id: r.id,
      })
      .select('id')
      .single()

    if (entryErr || !entry) { errors.push(`journal ${r.id}: ${entryErr?.message ?? 'header failed'}`); continue }

    const lines = (r.lines ?? []) as any[]
    const lineRows = lines.map((l: any) => ({
      entry_id:    entry.id,
      tenant_id:   tenantId,
      account_id:  l.account_id,
      description: l.description ?? null,
      debit:       l.side === 'debit'  ? l.amount : 0,
      credit:      l.side === 'credit' ? l.amount : 0,
    }))

    const { error: linesErr } = await (admin as any)
      .from('journal_lines')
      .insert(lineRows)
    if (linesErr) {
      await (admin as any).from('journal_entries').delete().eq('id', entry.id)
      errors.push(`journal ${r.id}: lines ${linesErr.message}`)
      continue
    }

    const nextRun = computeNextRunDate(new Date(issueDate), r.frequency, r.day_of_month)
    await (admin as any)
      .from('recurring_journals')
      .update({ last_run_date: issueDate, next_run_date: nextRun })
      .eq('id', r.id)
      .eq('tenant_id', tenantId)

    journalsGenerated += 1
  }

  return NextResponse.json({
    ok: true,
    billsGenerated,
    journalsGenerated,
    errors,
  })
}
