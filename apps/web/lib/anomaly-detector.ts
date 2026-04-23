/**
 * Anomaly detection engine.
 * Called by the /api/cron/anomaly-check route (triggered by Vercel Cron or manually).
 * For each tenant with enabled rules, evaluates metrics and fires alerts.
 */

import { createAdminClient } from '@/lib/supabase/admin'

export interface AnomalyResult {
  tenantId:  string
  metric:    string
  severity:  string
  message:   string
  details:   Record<string, unknown>
  ruleId:    string
}

/** Run all enabled rules for a single tenant. Returns any triggered anomalies. */
export async function detectAnomalies(tenantId: string): Promise<AnomalyResult[]> {
  const supabase = createAdminClient()

  const { data: rules } = await supabase
    .from('anomaly_rules')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_enabled', true)

  if (!rules || rules.length === 0) return []

  const results: AnomalyResult[] = []
  const now = new Date()

  for (const rule of rules) {
    try {
      const anomaly = await evaluateRule(tenantId, rule, now, supabase)
      if (anomaly) results.push(anomaly)
    } catch {
      // Don't let one rule failure block others
    }
  }

  return results
}

async function evaluateRule(
  tenantId: string,
  rule: any,
  now: Date,
  supabase: ReturnType<typeof createAdminClient>,
): Promise<AnomalyResult | null> {
  switch (rule.metric) {
    case 'revenue_drop':      return checkRevenueDrop(tenantId, rule, now, supabase)
    case 'occupancy_low':     return checkOccupancyLow(tenantId, rule, now, supabase)
    case 'payment_drought':   return checkPaymentDrought(tenantId, rule, now, supabase)
    case 'large_cash_payment': return checkLargeCashPayment(tenantId, rule, now, supabase)
    case 'high_discount':     return checkHighDiscount(tenantId, rule, now, supabase)
    case 'shift_discrepancy': return checkShiftDiscrepancy(tenantId, rule, now, supabase)
    default:                  return null
  }
}

/** Revenue this week vs same period last week. Alert if drop > threshold% */
async function checkRevenueDrop(tenantId: string, rule: any, now: Date, supabase: any): Promise<AnomalyResult | null> {
  const days = rule.window_days ?? 7
  const periodEnd   = now.toISOString()
  const periodStart = new Date(now.getTime() - days * 86400000).toISOString()
  const prevStart   = new Date(now.getTime() - days * 2 * 86400000).toISOString()

  const { data: current } = await supabase
    .from('payments')
    .select('amount')
    .eq('tenant_id', tenantId)
    .gte('created_at', periodStart)
    .lte('created_at', periodEnd)

  const { data: previous } = await supabase
    .from('payments')
    .select('amount')
    .eq('tenant_id', tenantId)
    .gte('created_at', prevStart)
    .lt('created_at', periodStart)

  const currentTotal  = (current  ?? []).reduce((s: number, r: any) => s + (r.amount ?? 0), 0)
  const previousTotal = (previous ?? []).reduce((s: number, r: any) => s + (r.amount ?? 0), 0)

  if (previousTotal === 0) return null  // No baseline, skip

  const dropPct = ((previousTotal - currentTotal) / previousTotal) * 100

  if (dropPct >= rule.threshold) {
    return {
      tenantId,
      metric:   rule.metric,
      severity: rule.severity,
      ruleId:   rule.id,
      message:  `Revenue dropped ${dropPct.toFixed(0)}% vs previous ${days}-day period (GH₵${(currentTotal / 100).toFixed(2)} vs GH₵${(previousTotal / 100).toFixed(2)})`,
      details:  { currentTotal, previousTotal, dropPct, windowDays: days },
    }
  }

  return null
}

/** Occupancy below threshold% today */
async function checkOccupancyLow(tenantId: string, rule: any, now: Date, supabase: any): Promise<AnomalyResult | null> {
  const { data: rooms } = await supabase
    .from('rooms')
    .select('status')
    .eq('tenant_id', tenantId)

  if (!rooms || rooms.length === 0) return null

  const occupied     = rooms.filter((r: any) => r.status === 'occupied').length
  const total        = rooms.length
  const occupancyPct = (occupied / total) * 100

  if (occupancyPct < rule.threshold) {
    return {
      tenantId,
      metric:   rule.metric,
      severity: rule.severity,
      ruleId:   rule.id,
      message:  `Occupancy is ${occupancyPct.toFixed(0)}% (${occupied}/${total} rooms) — below ${rule.threshold}% threshold`,
      details:  { occupied, total, occupancyPct, threshold: rule.threshold },
    }
  }

  return null
}

/** No payments recorded in the last N days */
async function checkPaymentDrought(tenantId: string, rule: any, now: Date, supabase: any): Promise<AnomalyResult | null> {
  const days = rule.window_days ?? 3
  const since = new Date(now.getTime() - days * 86400000).toISOString()

  const { count } = await supabase
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('created_at', since)

  if ((count ?? 0) === 0) {
    return {
      tenantId,
      metric:   rule.metric,
      severity: rule.severity,
      ruleId:   rule.id,
      message:  `No payments recorded in the last ${days} days — is the system receiving payments?`,
      details:  { windowDays: days },
    }
  }

  return null
}

/** Any single cash payment above threshold amount (pesewas) */
async function checkLargeCashPayment(tenantId: string, rule: any, now: Date, supabase: any): Promise<AnomalyResult | null> {
  const hours = rule.window_days ? rule.window_days * 24 : 24
  const since = new Date(now.getTime() - hours * 3600000).toISOString()
  const threshold = rule.threshold ?? 50000 // 500 GHS default

  const { data } = await supabase
    .from('booking_payments')
    .select('amount, paid_at')
    .eq('tenant_id', tenantId)
    .eq('method', 'cash')
    .eq('status', 'success')
    .gte('paid_at', since)
    .gt('amount', threshold)
    .order('amount', { ascending: false })
    .limit(1)

  if (data && data.length > 0) {
    return {
      tenantId,
      metric:   rule.metric,
      severity: rule.severity,
      ruleId:   rule.id,
      message:  `Large cash payment: GH₵${(data[0].amount / 100).toFixed(2)} — please verify`,
      details:  { amount: data[0].amount, paidAt: data[0].paid_at, threshold },
    }
  }
  return null
}

/** Bookings with discounts above threshold % */
async function checkHighDiscount(tenantId: string, rule: any, now: Date, supabase: any): Promise<AnomalyResult | null> {
  const hours = rule.window_days ? rule.window_days * 24 : 24
  const since = new Date(now.getTime() - hours * 3600000).toISOString()
  const threshold = rule.threshold ?? 20 // 20% default

  const { data } = await supabase
    .from('bookings')
    .select('id, booking_ref, final_amount, discount_amount, discount_reason')
    .eq('tenant_id', tenantId)
    .gt('discount_amount', 0)
    .gte('created_at', since)

  const flagged = (data ?? []).filter((b: any) => {
    const originalAmount = b.final_amount + b.discount_amount
    const discPct = originalAmount > 0 ? (b.discount_amount / originalAmount) * 100 : 0
    return discPct >= threshold
  })

  if (flagged.length > 0) {
    const b = flagged[0]
    const originalAmount = b.final_amount + b.discount_amount
    const discPct = (b.discount_amount / originalAmount) * 100
    return {
      tenantId,
      metric:   rule.metric,
      severity: rule.severity,
      ruleId:   rule.id,
      message:  `${b.booking_ref}: ${discPct.toFixed(0)}% discount (GH₵${(b.discount_amount / 100).toFixed(2)}) — ${b.discount_reason ?? 'no reason given'}`,
      details:  { bookingRef: b.booking_ref, discountPct: discPct, amount: b.discount_amount },
    }
  }
  return null
}

/** Flagged shift close-out discrepancies */
async function checkShiftDiscrepancy(tenantId: string, rule: any, now: Date, supabase: any): Promise<AnomalyResult | null> {
  const days = rule.window_days ?? 1
  const since = new Date(now.getTime() - days * 86400000).toISOString()

  try {
    const { data } = await supabase
      .from('shift_closeouts')
      .select('id, staff_id, system_cash, declared_cash, discrepancy, shift_date')
      .eq('tenant_id', tenantId)
      .eq('status', 'flagged')
      .gte('created_at', since)

    if (data && data.length > 0) {
      const worst = data.sort((a: any, b: any) => Math.abs(b.discrepancy) - Math.abs(a.discrepancy))[0]
      return {
        tenantId,
        metric:   rule.metric,
        severity: rule.severity,
        ruleId:   rule.id,
        message:  `Cash discrepancy: GH₵${(Math.abs(worst.discrepancy) / 100).toFixed(2)} on ${worst.shift_date} — ${data.length} flagged close-out(s)`,
        details:  { count: data.length, worstDiscrepancy: worst.discrepancy },
      }
    }
  } catch {
    // Table might not exist yet
  }
  return null
}

/** Persist detected anomalies to the alerts table */
export async function saveAnomalyAlerts(anomalies: AnomalyResult[]): Promise<void> {
  if (anomalies.length === 0) return
  const supabase = createAdminClient()

  await (supabase as any).from('anomaly_alerts').insert(
    anomalies.map(a => ({
      tenant_id: a.tenantId,
      rule_id:   a.ruleId,
      metric:    a.metric,
      severity:  a.severity,
      message:   a.message,
      details:   a.details,
    }))
  )
}
