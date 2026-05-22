/**
 * HTML daily digest email — built on the existing `baseTemplate` so styling
 * stays consistent with booking / payment receipts.
 */
import { baseTemplate, button } from '@/lib/email'
import type { DailyReport } from '@/lib/reports/daily'
import { ghs, pct, deltaPct, isCashVarianceConcerning, formatDate } from './format'

export function buildDigestEmail(opts: {
  hostelName:   string
  primaryColor: string
  logoUrl?:     string | null
  report:       DailyReport
  yesterday:    DailyReport | null
  sameDayLastWeek: DailyReport | null
  dashboardUrl: string
}): { subject: string; html: string } {
  const { hostelName, primaryColor, logoUrl, report, yesterday, sameDayLastWeek, dashboardUrl } = opts
  const dateLabel = formatDate(report.report_date)
  const subject = `${hostelName} · Daily report · ${dateLabel}`

  const dvYest = yesterday ? deltaPct(report.revenue_total, yesterday.revenue_total) : null
  const dvSdlw = sameDayLastWeek ? report.revenue_total - sameDayLastWeek.revenue_total : null

  const cashWarn = isCashVarianceConcerning(report)

  const content = `
    <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">${dateLabel}</p>
    <p style="margin:0 0 24px;font-size:22px;font-weight:700;color:#111827;">Daily operations</p>

    <!-- Hero revenue -->
    <div style="background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:20px;">
      <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;">Revenue</p>
      <p style="margin:6px 0 8px;font-size:30px;font-weight:700;color:${primaryColor};font-family:ui-monospace,monospace;">
        ${ghs(report.revenue_total)}
      </p>
      ${dvYest !== null
        ? `<p style="margin:0;font-size:13px;color:${dvYest >= 0 ? '#15803d' : '#b91c1c'};">${pct(dvYest)} vs yesterday</p>`
        : ''}
      ${dvSdlw !== null
        ? `<p style="margin:4px 0 0;font-size:12px;color:#6b7280;">${dvSdlw >= 0 ? '+' : ''}${ghs(dvSdlw)} vs same day last week</p>`
        : ''}
    </div>

    <!-- Stream breakdown -->
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      ${row('Rooms',     ghs(report.revenue_rooms))}
      ${row('Food',      ghs(report.revenue_food))}
      ${row('POS sales', ghs(report.revenue_pos))}
      ${row('Walk-in',   ghs(report.revenue_walkin))}
      ${row('Deposits',  ghs(report.revenue_deposits))}
    </table>

    <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.05em;">By payment method</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      ${row('Cash',           ghs(report.rev_cash))}
      ${row('Mobile Money',   ghs(report.rev_momo))}
      ${row('Card',           ghs(report.rev_card))}
      ${row('Bank Transfer',  ghs(report.rev_bank))}
      ${report.rev_online_other > 0 ? row('On account', ghs(report.rev_online_other)) : ''}
    </table>

    <!-- Occupancy + movement + cash -->
    <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.05em;">Operations</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      ${row('Occupancy', `${report.rooms_occupied}/${report.rooms_total} (${Math.round(Number(report.occupancy_pct))}%)`)}
      ${row('Check-ins',  String(report.arrivals_today))}
      ${row('Check-outs', String(report.departures_today))}
      ${report.no_shows_today > 0 ? row('No-shows', String(report.no_shows_today)) : ''}
      ${row('Walk-in QR sales', String(report.walkin_count))}
      ${row('Food orders',      String(report.food_orders_count))}
    </table>

    ${cashWarn
      ? `<div style="background:#fef3c7;border-radius:8px;padding:12px 16px;margin-bottom:24px;">
           <p style="margin:0;font-size:12px;color:#92400e;">
             <strong>Cash variance: ${ghs(report.cash_variance)}</strong>
             — exceeds the 2% / GH₵ 50 threshold. Expected ${ghs(report.cash_expected)},
             counted ${ghs(report.cash_counted)}.
           </p>
         </div>`
      : `<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:24px;">
           ${row('Cash variance', ghs(report.cash_variance))}
         </table>`}

    <!-- Open issues -->
    <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.05em;">Open issues (now)</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      ${row('Maintenance open',       String(report.maintenance_open))}
      ${row('Housekeeping pending',   String(report.housekeeping_pending))}
      ${row('Laundry in progress',    String(report.laundry_in_progress))}
      ${row('Bank drafts pending',    String(report.bank_drafts_pending))}
      ${row('Critical anomalies',     String(report.anomalies_critical))}
      ${row('Overdue installments',
            `${report.overdue_installments_count} · ${ghs(report.overdue_installments_amount)}`)}
      ${row('Outstanding receivable', ghs(report.outstanding_balance))}
    </table>

    ${report.first_anomaly_msg
      ? `<div style="background:#fef2f2;border-left:3px solid #ef4444;border-radius:6px;padding:12px 16px;margin-bottom:24px;">
           <p style="margin:0;font-size:12px;color:#991b1b;"><strong>Latest critical:</strong> ${escapeHtml(report.first_anomaly_msg)}</p>
         </div>`
      : ''}

    <!-- Outlook -->
    <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.05em;">Outlook</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:28px;">
      ${row('Arrivals · next 7 days',  String(report.arrivals_next_7d))}
      ${row('Renewals due · 30 days',  String(report.renewals_due_30d))}
      ${row('Lease expiry · 30 days',  String(report.lease_expiry_30d))}
    </table>

    ${button(dashboardUrl, 'Open dashboard', primaryColor)}

    <p style="margin:20px 0 0;font-size:11px;color:#9ca3af;text-align:center;">
      Snapshot taken ${new Date(report.computed_at).toLocaleString('en-GH', { dateStyle: 'medium', timeStyle: 'short' })}.
      Forward this email to your accountant or partners as needed.
    </p>
  `

  return {
    subject,
    html: baseTemplate(hostelName, primaryColor, content, logoUrl),
  }
}

function row(label: string, value: string) {
  return `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#6b7280;">${label}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;text-align:right;font-family:ui-monospace,monospace;">${value}</td>
    </tr>
  `
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
