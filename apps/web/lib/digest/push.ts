/**
 * Web push notification for the daily digest.
 * Compact title + one-line body that surfaces the most useful metric.
 */
import type { DailyReport } from '@/lib/reports/daily'
import { ghs, isCashVarianceConcerning, formatDate } from './format'

export function buildDigestPush(opts: {
  hostelName: string
  report:     DailyReport
}): { title: string; body: string; url: string; nativePath: string; nativeData: Record<string, string> } {
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
    // Browsers go to the full web dashboard; the native app only has the
    // slim /owner-digest route (see lib/push.ts's PushPayload.nativePath).
    url:        '/dashboard/owner',
    nativePath: '/owner-digest',
    nativeData: { type: 'daily_digest', report_date: report.report_date },
  }
}
