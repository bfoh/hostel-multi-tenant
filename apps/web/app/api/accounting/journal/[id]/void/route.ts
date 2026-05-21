import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface VoidBody {
  reason?:   string
  /** When true, instead of marking voided, posts a NEW entry with debit/credit swapped. */
  reverse?:  boolean
  /** Optional override for the reversing entry's date (defaults to today). */
  reverse_date?: string
}

/**
 * POST /api/accounting/journal/[id]/void
 *
 * - reverse=false (default): marks the entry as voided and stamps the reason.
 *   The original lines stay in the journal but the audit field flags the entry.
 *   Use this when the entry was a clear mistake captured the same day.
 *
 * - reverse=true: leaves the original alone (so the audit trail survives) and
 *   posts a NEW entry on the chosen date with debit/credit swapped on every
 *   line, then stamps reverses_entry_id on the new entry pointing back at the
 *   original. Use this when the entry has already been included in a closed
 *   period or shared report and needs to be unwound cleanly.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const tenantId = (await headers()).get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const { id } = await params
  const body: VoidBody = await req.json().catch(() => ({}))

  const admin = createAdminClient()
  const { data: entry } = await (admin as any)
    .from('journal_entries')
    .select('id, entry_date, description, source, voided_at, reverses_entry_id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
  if (entry.voided_at) return NextResponse.json({ error: 'Entry is already voided' }, { status: 400 })

  if (body.reverse) {
    const reverseDate = body.reverse_date && /^\d{4}-\d{2}-\d{2}$/.test(body.reverse_date)
      ? body.reverse_date
      : new Date().toISOString().slice(0, 10)

    const { data: lines } = await (admin as any)
      .from('journal_lines')
      .select('account_id, debit, credit, description')
      .eq('tenant_id', tenantId)
      .eq('entry_id', id)
    if (!lines || lines.length === 0) {
      return NextResponse.json({ error: 'Original entry has no lines' }, { status: 400 })
    }

    const { data: newEntry, error: insErr } = await (admin as any)
      .from('journal_entries')
      .insert({
        tenant_id:         tenantId,
        entry_date:        reverseDate,
        reference:         `REV-${id.slice(0, 8)}`,
        description:       `Reversal: ${entry.description}`,
        source:            'manual',
        posted_by:         user.id,
        reverses_entry_id: id,
      })
      .select('id')
      .single()
    if (insErr || !newEntry) {
      return NextResponse.json({ error: insErr?.message ?? 'Failed to create reversing entry' }, { status: 500 })
    }

    const swapped = (lines as any[]).map((l) => ({
      entry_id:    newEntry.id,
      tenant_id:   tenantId,
      account_id:  l.account_id,
      description: l.description,
      debit:       l.credit,    // swap
      credit:      l.debit,
    }))
    const { error: linesErr } = await (admin as any).from('journal_lines').insert(swapped)
    if (linesErr) {
      await (admin as any).from('journal_entries').delete().eq('id', newEntry.id)
      return NextResponse.json({ error: linesErr.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, reversing_entry_id: newEntry.id })
  }

  // Void in place
  const { error } = await (admin as any)
    .from('journal_entries')
    .update({
      voided_at:   new Date().toISOString(),
      voided_by:   user.id,
      void_reason: body.reason?.trim() || null,
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
