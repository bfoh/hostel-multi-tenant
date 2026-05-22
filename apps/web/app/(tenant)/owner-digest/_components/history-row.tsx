import Link from 'next/link'
import type { DailyReport } from '@/lib/reports/daily'
import { formatGHS } from '@/lib/utils'

export function HistoryRow({ report }: { report: DailyReport }) {
  return (
    <Link
      href={`/owner-digest/${report.report_date}`}
      className="flex items-center justify-between border-b border-slate-100 py-3 active:bg-slate-50"
    >
      <div>
        <div className="text-sm font-medium text-slate-900">{report.report_date}</div>
        <div className="mt-0.5 text-xs text-slate-500">
          Occ {Number(report.occupancy_pct).toFixed(0)}% · Rev {formatGHS(report.revenue_total)}
        </div>
      </div>
      <span className="text-slate-300">›</span>
    </Link>
  )
}
