import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'

export interface FxRevalRow {
  bill_id:             string
  vendor_name:         string
  description:         string
  currency_code:       string
  original_amount:     number   // pesewas in foreign currency, captured
  capture_rate:        number   // GHS per 1 foreign unit, captured
  base_amount:         number   // pesewas in GHS at capture (= original × capture_rate)
  paid_amount:         number   // pesewas in GHS already paid
  ghsBalance:          number   // pesewas GHS still owing under capture-rate accounting
  foreignOutstanding:  number   // pesewas foreign currency still owing
  current_rate:        number   // latest available rate as of selected date
  rate_as_of:          string   // YYYY-MM-DD
  restatedBalance:     number   // pesewas GHS at current rate
  delta:               number   // restated − current (positive = loss; negative = gain)
}

export interface FxRevalPreview {
  asOfDate:        string
  rows:            FxRevalRow[]
  totalGain:       number       // pesewas (sum of negative deltas, made positive)
  totalLoss:       number       // pesewas (sum of positive deltas)
  netAdjustment:   number       // gain − loss (positive = favorable)
  missingRates:    string[]     // currency codes with no available rate
  alreadyPosted:   boolean
}

/**
 * Builds an FX revaluation preview as of the given date.
 *
 * For each open foreign-currency supplier bill, computes:
 *   - foreignOutstanding = original_amount × (ghsBalance / base_amount)
 *     (proportional outstanding in the original currency)
 *   - restatedBalance    = foreignOutstanding × current_rate
 *   - delta              = restated − current
 *
 * Positive delta = unrealized FX LOSS (we owe more GHS now). Negative = GAIN.
 */
export async function getFxRevaluationPreview(asOfDate: string): Promise<FxRevalPreview | null> {
  const tenantId = await getServerTenantId()
  if (!tenantId) return null

  const supabase = createAdminClient()

  const [{ data: bills }, { data: rates }, { data: existingRun }] = await Promise.all([
    (supabase as any)
      .from('supplier_bills')
      .select('id, vendor_name, description, amount, paid_amount, currency_code, original_amount, fx_rate_used, status')
      .eq('tenant_id', tenantId)
      .in('status', ['approved', 'partial'])
      .neq('currency_code', 'GHS'),
    (supabase as any)
      .from('fx_rates')
      .select('currency_code, rate_to_base, as_of_date')
      .eq('tenant_id', tenantId)
      .lte('as_of_date', asOfDate)
      .order('as_of_date', { ascending: false })
      .limit(500),
    (supabase as any)
      .from('fx_revaluation_runs')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('as_of_date', asOfDate)
      .maybeSingle(),
  ])

  // Latest rate per currency as of the chosen date
  const rateByCcy = new Map<string, { rate: number; asOf: string }>()
  for (const r of (rates ?? []) as any[]) {
    if (!rateByCcy.has(r.currency_code)) {
      rateByCcy.set(r.currency_code, { rate: Number(r.rate_to_base), asOf: r.as_of_date })
    }
  }

  const rows: FxRevalRow[] = []
  const missing = new Set<string>()

  for (const b of (bills ?? []) as any[]) {
    if (!b.currency_code || !b.original_amount || !b.fx_rate_used) continue
    const ghsBalance = Math.max(0, Number(b.amount) - Number(b.paid_amount))
    if (ghsBalance <= 0) continue

    const baseAmount = Number(b.amount)
    const foreignOutstanding = baseAmount > 0
      ? Math.round((ghsBalance / baseAmount) * Number(b.original_amount))
      : 0

    const fx = rateByCcy.get(b.currency_code)
    if (!fx) { missing.add(b.currency_code); continue }

    const restatedBalance = Math.round((foreignOutstanding / 100) * fx.rate * 100)
    const delta = restatedBalance - ghsBalance

    rows.push({
      bill_id:            b.id,
      vendor_name:        b.vendor_name,
      description:        b.description,
      currency_code:      b.currency_code,
      original_amount:    Number(b.original_amount),
      capture_rate:       Number(b.fx_rate_used),
      base_amount:        baseAmount,
      paid_amount:        Number(b.paid_amount),
      ghsBalance,
      foreignOutstanding,
      current_rate:       fx.rate,
      rate_as_of:         fx.asOf,
      restatedBalance,
      delta,
    })
  }

  let totalGain = 0
  let totalLoss = 0
  for (const r of rows) {
    if (r.delta < 0) totalGain += -r.delta
    if (r.delta > 0) totalLoss +=  r.delta
  }

  return {
    asOfDate,
    rows: rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
    totalGain,
    totalLoss,
    netAdjustment: totalGain - totalLoss,
    missingRates:  Array.from(missing).sort(),
    alreadyPosted: Boolean(existingRun),
  }
}
