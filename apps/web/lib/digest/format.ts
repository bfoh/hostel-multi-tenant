/**
 * Shared formatters for the daily digest (SMS, email, push).
 *
 * All builders read from the pre-aggregated `tenant_daily_reports` row, so
 * SMS, email, push, and the owner dashboard always show identical figures.
 */
import type { DailyReport } from '@/lib/reports/daily'

export function ghs(p: number): string {
  return `GH₵ ${(p / 100).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function pct(n: number): string {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

/**
 * Cash variance is "concerning" when it exceeds 2% of expected OR
 * GH₵ 50 in absolute terms (covers small/zero-expected days).
 */
export function isCashVarianceConcerning(report: DailyReport): boolean {
  if (report.cash_variance === 0) return false
  if (report.cash_expected === 0) return Math.abs(report.cash_variance) > 5000
  return Math.abs(report.cash_variance / report.cash_expected) > 0.02
}

/**
 * Compute % delta vs comparison. Falls back to 0 when comparison is 0.
 */
export function deltaPct(current: number, previous: number): number {
  if (previous <= 0) return 0
  return ((current - previous) / previous) * 100
}

export function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GH', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}
