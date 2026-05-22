import type { DailyReport } from '@/lib/reports/daily'
import { formatGHS } from '@/lib/utils'

interface Props {
  report:     DailyReport
  yesterday?: DailyReport | null
}

/**
 * Read-only digest card. Pure data render — no drill-downs.
 * Used by today's view and the per-day history view.
 */
export function DigestCard({ report, yesterday }: Props) {
  const occDelta = yesterday
    ? Number(report.occupancy_pct) - Number(yesterday.occupancy_pct)
    : null
  const revDelta = yesterday
    ? Number(report.revenue_total) - Number(yesterday.revenue_total)
    : null

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Digest · {report.report_date}
      </h2>

      <section className="mt-4 grid grid-cols-2 gap-4">
        <Metric
          label="Occupancy"
          value={`${Number(report.occupancy_pct).toFixed(1)}%`}
          delta={occDelta !== null ? formatPctDelta(occDelta) : null}
          deltaTone={toneFromNumber(occDelta)}
        />
        <Metric
          label="Revenue today"
          value={formatGHS(report.revenue_total)}
          delta={revDelta !== null ? formatGhsDelta(revDelta) : null}
          deltaTone={toneFromNumber(revDelta)}
        />
        <Metric label="Outstanding" value={formatGHS(report.outstanding_balance)} />
        <Metric
          label="Overdue installments"
          value={`${report.overdue_installments_count}`}
          sub={formatGHS(report.overdue_installments_amount)}
        />
      </section>

      <Section title="Rooms">
        <KV k="Occupied"    v={`${report.rooms_occupied} / ${report.rooms_total}`} />
        <KV k="Reserved"    v={`${report.rooms_reserved}`} />
        <KV k="Dirty"       v={`${report.rooms_dirty}`} />
        <KV k="Maintenance" v={`${report.rooms_maintenance}`} />
      </Section>

      <Section title="Movement">
        <KV k="Arrivals"    v={`${report.arrivals_today}`} />
        <KV k="Departures"  v={`${report.departures_today}`} />
        <KV k="No-shows"    v={`${report.no_shows_today}`} />
        <KV k="Walk-ins"    v={`${report.walkin_count}`} />
      </Section>

      <Section title="Revenue breakdown">
        <KV k="Rooms"    v={formatGHS(report.revenue_rooms)} />
        <KV k="Food"     v={formatGHS(report.revenue_food)} />
        <KV k="POS"      v={formatGHS(report.revenue_pos)} />
        <KV k="Walk-in"  v={formatGHS(report.revenue_walkin)} />
        <KV k="Deposits" v={formatGHS(report.revenue_deposits)} />
      </Section>

      <Section title="Cash">
        <KV k="Expected" v={formatGHS(report.cash_expected)} />
        <KV k="Counted"  v={formatGHS(report.cash_counted)} />
        <KV k="Variance" v={formatGHS(report.cash_variance)} tone={report.cash_variance < 0 ? 'bad' : undefined} />
        <KV k="Drafts pending" v={`${report.bank_drafts_pending}`} />
      </Section>

      {(report.anomalies_critical > 0 || report.anomalies_warning > 0) && (
        <Section title="Alerts">
          <KV k="Critical" v={`${report.anomalies_critical}`} tone={report.anomalies_critical > 0 ? 'bad' : undefined} />
          <KV k="Warning"  v={`${report.anomalies_warning}`}  tone={report.anomalies_warning  > 0 ? 'warn' : undefined} />
          {report.first_anomaly_msg && (
            <p className="col-span-2 mt-1 text-xs text-amber-700">{report.first_anomaly_msg}</p>
          )}
        </Section>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{title}</h3>
      <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-slate-700">{children}</ul>
    </section>
  )
}

function KV({ k, v, tone }: { k: string; v: string; tone?: 'bad' | 'warn' }) {
  const colour =
    tone === 'bad'  ? 'text-red-600'   :
    tone === 'warn' ? 'text-amber-700' :
                      'text-slate-900'
  return (
    <li className="flex items-baseline justify-between">
      <span className="text-slate-500">{k}</span>
      <span className={`font-medium ${colour}`}>{v}</span>
    </li>
  )
}

function Metric({
  label, value, sub, delta, deltaTone,
}: {
  label: string
  value: string
  sub?: string
  delta?: string | null
  deltaTone?: 'good' | 'bad' | null
}) {
  const deltaColour =
    deltaTone === 'good' ? 'text-emerald-600' :
    deltaTone === 'bad'  ? 'text-red-600'     :
                           'text-slate-500'
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
      {sub   && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
      {delta && <div className={`mt-0.5 text-xs ${deltaColour}`}>{delta} vs. yesterday</div>}
    </div>
  )
}

function formatPctDelta(n: number): string {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(1)} pts`
}

function formatGhsDelta(n: number): string {
  const sign = n >= 0 ? '+' : '−'
  return `${sign}${formatGHS(Math.abs(n))}`
}

function toneFromNumber(n: number | null): 'good' | 'bad' | null {
  if (n === null || n === 0) return null
  return n > 0 ? 'good' : 'bad'
}
