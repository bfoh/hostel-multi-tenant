/**
 * Concise SMS digest. Target: 2 Arkesel segments (≤ ~300 chars).
 *
 * Layout:
 *   Hostel · Mon 18-May
 *
 *   Revenue: GH₵ X (+Y%)
 *     Rooms A · Food B · POS C · Walk-in D
 *   Occupancy: 28/30 (93%)
 *   In/Out: +3 / -1
 *   Cash var: GH₵ 0
 *   Open: 2 maint · 4 laundry
 *   ⚠ Critical: <first anomaly message>
 *
 *   View: <link>
 */
import type { DailyReport } from '@/lib/reports/daily'
import { ghs, pct, deltaPct, isCashVarianceConcerning, formatDate } from './format'

export function buildDigestSms(opts: {
  hostelName:   string
  report:       DailyReport
  yesterday:    DailyReport | null
  dashboardUrl: string
}): string {
  const { hostelName, report, yesterday, dashboardUrl } = opts
  const rev = report.revenue_total
  const delta = deltaPct(rev, yesterday?.revenue_total ?? 0)

  const lines: string[] = []
  lines.push(`${hostelName} · ${formatDate(report.report_date)}`)
  lines.push('')
  lines.push(`Revenue: ${ghs(rev)}${yesterday ? ` (${pct(delta)})` : ''}`)

  // Stream breakdown only when there is revenue
  if (rev > 0) {
    const streams: string[] = []
    if (report.revenue_rooms  > 0) streams.push(`Rooms ${ghs(report.revenue_rooms)}`)
    if (report.revenue_food   > 0) streams.push(`Food ${ghs(report.revenue_food)}`)
    if (report.revenue_pos    > 0) streams.push(`POS ${ghs(report.revenue_pos)}`)
    if (report.revenue_walkin > 0) streams.push(`Walk-in ${ghs(report.revenue_walkin)}`)
    if (streams.length > 0) {
      lines.push(`  ${streams.join(' · ')}`)
    }
  }

  lines.push(
    `Occupancy: ${report.rooms_occupied}/${report.rooms_total} (${Math.round(Number(report.occupancy_pct))}%)`
  )
  lines.push(`In/Out: +${report.arrivals_today} / -${report.departures_today}`)

  if (isCashVarianceConcerning(report)) {
    lines.push(`⚠ Cash var: ${ghs(report.cash_variance)}`)
  } else {
    lines.push(`Cash var: ${ghs(report.cash_variance)}`)
  }

  const openParts: string[] = []
  if (report.maintenance_open    > 0) openParts.push(`${report.maintenance_open} maint`)
  if (report.laundry_in_progress > 0) openParts.push(`${report.laundry_in_progress} laundry`)
  if (report.bank_drafts_pending > 0) openParts.push(`${report.bank_drafts_pending} drafts`)
  if (openParts.length > 0) lines.push(`Open: ${openParts.join(' · ')}`)

  if (report.anomalies_critical > 0 && report.first_anomaly_msg) {
    lines.push(`⚠ ${truncate(report.first_anomaly_msg, 70)}`)
  }

  if (report.outstanding_balance > 0) {
    lines.push(`Outstanding: ${ghs(report.outstanding_balance)}`)
  }

  lines.push('')
  lines.push(`View: ${dashboardUrl}`)

  return lines.join('\n').slice(0, 600)
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}
