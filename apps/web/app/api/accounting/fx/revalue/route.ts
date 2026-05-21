import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getFxRevaluationPreview } from '@/lib/data/fx-revaluation'

interface RunBody {
  as_of_date: string  // YYYY-MM-DD
}

/**
 * POST /api/accounting/fx/revalue
 *
 * Posts a one-time revaluation entry for the given as-of date. Refuses
 * if a run already exists for the date. The journal entry contains a DR
 * 5300 / CR 2010 line for every individual loss row and a DR 2010 / CR
 * 4040 line for every gain row so the per-bill exposure remains traceable
 * via journal_lines.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const tenantId = (await headers()).get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  let body: RunBody
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.as_of_date || !/^\d{4}-\d{2}-\d{2}$/.test(body.as_of_date)) {
    return NextResponse.json({ error: 'as_of_date required (YYYY-MM-DD)' }, { status: 400 })
  }
  const today = new Date(); today.setHours(0, 0, 0, 0)
  if (new Date(body.as_of_date) > today) {
    return NextResponse.json({ error: 'Cannot revalue a future date' }, { status: 400 })
  }

  const preview = await getFxRevaluationPreview(body.as_of_date)
  if (!preview) return NextResponse.json({ error: 'No tenant context' }, { status: 400 })
  if (preview.alreadyPosted) {
    return NextResponse.json({ error: 'Revaluation already posted for this date' }, { status: 400 })
  }
  if (preview.missingRates.length > 0) {
    return NextResponse.json({
      error: `Missing FX rate for: ${preview.missingRates.join(', ')}. Capture rates under FX Rates first.`,
    }, { status: 400 })
  }
  if (preview.rows.length === 0) {
    return NextResponse.json({ error: 'No open foreign-currency bills to revalue' }, { status: 400 })
  }
  if (preview.totalGain === 0 && preview.totalLoss === 0) {
    return NextResponse.json({ error: 'No net adjustment — captured rates match current rates' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Resolve required GL accounts
  const { data: ap }      = await (admin as any).from('chart_of_accounts').select('id').eq('tenant_id', tenantId).eq('code', '2010').single()
  const { data: fxGain }  = await (admin as any).from('chart_of_accounts').select('id').eq('tenant_id', tenantId).eq('code', '4040').single()
  const { data: fxLoss }  = await (admin as any).from('chart_of_accounts').select('id').eq('tenant_id', tenantId).eq('code', '5300').single()
  if (!ap || !fxGain || !fxLoss) {
    return NextResponse.json({ error: 'Chart of accounts missing 2010 / 4040 / 5300 — apply migration 086' }, { status: 500 })
  }

  // Build lines per bill so per-row exposure stays traceable in the journal
  const lines: { account_id: string; debit: number; credit: number; description: string }[] = []
  for (const r of preview.rows) {
    if (r.delta === 0) continue
    if (r.delta > 0) {
      // Loss: DR 5300 / CR 2010
      lines.push({ account_id: fxLoss.id, debit: r.delta, credit: 0,       description: `${r.vendor_name} · ${r.currency_code} loss` })
      lines.push({ account_id: ap.id,     debit: 0,        credit: r.delta, description: `${r.vendor_name} · ${r.currency_code} loss` })
    } else {
      const amt = -r.delta
      // Gain: DR 2010 / CR 4040
      lines.push({ account_id: ap.id,     debit: amt, credit: 0,   description: `${r.vendor_name} · ${r.currency_code} gain` })
      lines.push({ account_id: fxGain.id, debit: 0,   credit: amt, description: `${r.vendor_name} · ${r.currency_code} gain` })
    }
  }

  if (lines.length === 0) {
    return NextResponse.json({ error: 'Nothing to post' }, { status: 400 })
  }

  // Sanity check
  const debitTotal  = lines.reduce((s, l) => s + l.debit,  0)
  const creditTotal = lines.reduce((s, l) => s + l.credit, 0)
  if (debitTotal !== creditTotal) {
    return NextResponse.json({ error: `Lines out of balance: D=${debitTotal} C=${creditTotal}` }, { status: 500 })
  }

  // Post header
  const { data: entry, error: entryErr } = await (admin as any)
    .from('journal_entries')
    .insert({
      tenant_id:   tenantId,
      entry_date:  body.as_of_date,
      reference:   `FX-REVAL-${body.as_of_date}`,
      description: `FX revaluation — ${preview.rows.length} foreign-currency bill${preview.rows.length === 1 ? '' : 's'}`,
      source:      'manual',
      posted_by:   user.id,
    })
    .select('id')
    .single()
  if (entryErr || !entry) return NextResponse.json({ error: entryErr?.message ?? 'Journal failed' }, { status: 500 })

  const { error: linesErr } = await (admin as any)
    .from('journal_lines')
    .insert(lines.map((l) => ({ ...l, entry_id: entry.id, tenant_id: tenantId })))
  if (linesErr) {
    await (admin as any).from('journal_entries').delete().eq('id', entry.id)
    return NextResponse.json({ error: linesErr.message }, { status: 500 })
  }

  const { error: runErr } = await (admin as any)
    .from('fx_revaluation_runs')
    .insert({
      tenant_id:        tenantId,
      as_of_date:       body.as_of_date,
      bill_count:       preview.rows.length,
      total_gain:       preview.totalGain,
      total_loss:       preview.totalLoss,
      net_adjustment:   preview.netAdjustment,
      journal_entry_id: entry.id,
      posted_by:        user.id,
    })
  if (runErr) return NextResponse.json({ error: runErr.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    entry_id: entry.id,
    total_gain: preview.totalGain,
    total_loss: preview.totalLoss,
    net_adjustment: preview.netAdjustment,
    bill_count: preview.rows.length,
  })
}
