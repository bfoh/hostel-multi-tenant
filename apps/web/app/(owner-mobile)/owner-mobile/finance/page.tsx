import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveMobileContext } from '@/lib/auth/mobile-context'
import { Wallet, ChevronRight, BarChart3, Receipt, CreditCard, FileText } from 'lucide-react'
import { getDailyReport, getTenantToday, listDailyReports, rollupReports, deltaVs } from '@/lib/reports/daily'
import { formatGHS } from '@/lib/utils'

export const metadata: Metadata = { title: 'Finance · Owner' }
export const dynamic = 'force-dynamic'

const LINKS = [
  { href: '/reports',            label: 'Reports',        sub: 'Occupancy, revenue & retention trends', icon: BarChart3 },
  { href: '/accounting',         label: 'Accounting',      sub: 'Ledger, expenses & reconciliation',      icon: Receipt },
  { href: '/invoices',           label: 'Invoices',        sub: 'Outstanding balances & receipts',        icon: FileText },
  { href: '/payments/drafts',    label: 'Bank drafts',     sub: 'Pending drafts to review',                icon: CreditCard },
  { href: '/settings/billing',   label: 'Subscription',    sub: 'Plan, billing & payout account',          icon: Wallet },
]

function isoMinus(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

export default async function OwnerMobileFinancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await resolveMobileContext(user.id)
  if (ctx.role !== 'owner' || !ctx.tenantId) redirect('/login')
  const tenantId: string = ctx.tenantId

  const today     = await getTenantToday(tenantId)
  const weekStart = isoMinus(today, 6)
  const prevStart = isoMinus(today, 13)
  const prevEnd   = isoMinus(today, 7)

  const [todayReport, thisWeekRows, lastWeekRows] = await Promise.all([
    getDailyReport(tenantId, today),
    listDailyReports(tenantId, weekStart, today),
    listDailyReports(tenantId, prevStart, prevEnd),
  ])

  const thisWeek = rollupReports(thisWeekRows)
  const lastWeek = rollupReports(lastWeekRows)
  const revenueDelta = deltaVs(thisWeek.revenue_total, lastWeek.revenue_total)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-slate-800">Finance</h1>
        <p className="mt-0.5 text-xs text-slate-500">Last 7 days vs. the 7 before</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Revenue this week</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{formatGHS(thisWeek.revenue_total)}</p>
        {lastWeek.days > 0 && (
          <p className={`mt-0.5 text-xs ${revenueDelta.delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {revenueDelta.delta >= 0 ? '+' : '−'}{formatGHS(Math.abs(revenueDelta.delta))} ({revenueDelta.pct.toFixed(0)}%) vs. previous week
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Outstanding</p>
            <p className="mt-1 text-lg font-semibold text-red-600">
              {formatGHS(todayReport?.outstanding_balance ?? 0)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Occupancy avg</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{thisWeek.occupancy_pct_avg.toFixed(0)}%</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-slate-100 pt-4 text-sm">
          <KV k="Rooms"    v={formatGHS(thisWeek.revenue_rooms)} />
          <KV k="Food"     v={formatGHS(thisWeek.revenue_food)} />
          <KV k="POS"      v={formatGHS(thisWeek.revenue_pos)} />
          <KV k="Walk-in"  v={formatGHS(thisWeek.revenue_walkin)} />
        </div>
      </div>

      <section className="space-y-2.5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Manage</p>
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors active:bg-slate-50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50">
              <l.icon className="h-4.5 w-4.5 text-slate-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800">{l.label}</p>
              <p className="text-xs text-slate-500">{l.sub}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
          </Link>
        ))}
      </section>
    </div>
  )
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-slate-500">{k}</span>
      <span className="font-medium text-slate-900">{v}</span>
    </div>
  )
}
