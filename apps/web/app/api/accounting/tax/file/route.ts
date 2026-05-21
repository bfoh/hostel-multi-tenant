import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface FileBody {
  kind:         'vat_levies' | 'paye' | 'ssnit' | 'corporate'
  period_year:  number
  period_month: number | null
  due_date:     string
  amount_due:   number       // pesewas
  reference?:   string       // GRA receipt number
  proof_url?:   string
  notes?:       string
}

const VALID_KINDS = new Set(['vat_levies', 'paye', 'ssnit', 'corporate'])

/**
 * POST /api/accounting/tax/file
 *
 * Records a filing against the tax_filings register (or updates an
 * existing pending row for the same kind+period). The amount + GRA
 * reference are snapshotted at filing time so the register survives
 * later journal corrections.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const tenantId = (await headers()).get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  let body: FileBody
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!VALID_KINDS.has(body.kind)) return NextResponse.json({ error: 'Invalid kind' }, { status: 400 })
  if (!Number.isInteger(body.period_year) || body.period_year < 2000 || body.period_year > 2100) {
    return NextResponse.json({ error: 'period_year out of range' }, { status: 400 })
  }
  if (body.kind === 'corporate') {
    if (body.period_month !== null && body.period_month !== undefined) {
      return NextResponse.json({ error: 'corporate filing must have period_month = null' }, { status: 400 })
    }
  } else {
    if (!Number.isInteger(body.period_month) || body.period_month! < 1 || body.period_month! > 12) {
      return NextResponse.json({ error: 'period_month must be 1..12 for non-corporate filings' }, { status: 400 })
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.due_date)) {
    return NextResponse.json({ error: 'due_date required (YYYY-MM-DD)' }, { status: 400 })
  }
  if (!Number.isInteger(body.amount_due) || body.amount_due < 0) {
    return NextResponse.json({ error: 'amount_due must be non-negative integer pesewas' }, { status: 400 })
  }

  const admin = createAdminClient()
  const filedAt = new Date().toISOString()

  const { error } = await (admin as any)
    .from('tax_filings')
    .upsert({
      tenant_id:    tenantId,
      kind:         body.kind,
      period_year:  body.period_year,
      period_month: body.period_month ?? null,
      due_date:     body.due_date,
      amount_due:   body.amount_due,
      reference:    body.reference?.trim() || null,
      proof_url:    body.proof_url?.trim() || null,
      notes:        body.notes?.trim()     || null,
      status:       'filed',
      filed_at:     filedAt,
      filed_by:     user.id,
    }, { onConflict: 'tenant_id,kind,period_year,period_month' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
