/**
 * Web push notification for the daily digest.
 * Compact title + one-line body that surfaces the most useful metric.
 */
import type { DailyReport } from '@/lib/reports/daily'
import { ghs, isCashVarianceConcerning, formatDate } from './format'

export function buildDigestPush(opts: {
  hostelName: string
  report:     DailyReport
}): { title: string; body: string; url: string } {
  const { hostelName, report } = opts

  const bits: string[] = []
  bits.push(`Rev ${ghs(report.revenue_total)}`)
  bits.push(`${Math.round(Number(report.occupancy_pct))}% occ`)
  if (isCashVarianceConcerning(report)) {
    bits.push(`⚠ cash ${ghs(report.cash_variance)}`)
  }
  if (report.anomalies_critical > 0) {
    bits.push(`${report.anomalies_critical} critical`)
  }

  return {
    title: `${hostelName} · ${formatDate(report.report_date)}`,
    body:  bits.join(' · '),
    url:   '/dashboard/owner',
  }
}
