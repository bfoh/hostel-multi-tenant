import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { listDailyReports, getTenantToday } from '@/lib/reports/daily'
import { HistoryRow } from '../_components/history-row'

export const metadata: Metadata = { title: 'Digest history' }
export const dynamic = 'force-dynamic'

const HISTORY_DAYS = 90

export default async function OwnerDigestHistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient() as any
  const { data: member } = await admin
    .from('tenant_members')
    .select('tenant_id')
    .eq('user_id', user.id)
    .eq('role', 'owner')
    .eq('is_active', true)
    .maybeSingle()
  if (!member) redirect('/login')
  const tenantId: string = member.tenant_id

  const today    = await getTenantToday(tenantId)
  const startIso = isoMinus(today, HISTORY_DAYS)
  const rows     = await listDailyReports(tenantId, startIso, today)

  // Newest first for the list view.
  const sorted = [...rows].sort((a, b) => (a.report_date < b.report_date ? 1 : -1))

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <Link href="/owner-digest" className="flex items-center gap-1 text-sm text-slate-500">
          <ChevronLeft className="h-4 w-4" /> Today
        </Link>
        <h1 className="text-base font-semibold text-slate-900">History</h1>
        <span className="w-16" />
      </header>

      <p className="mb-2 text-xs text-slate-500">Last {HISTORY_DAYS} days</p>

      <ul className="rounded-2xl bg-white px-4 shadow-sm ring-1 ring-slate-200">
        {sorted.length === 0 ? (
          <li className="py-6 text-center text-sm text-slate-500">No past digests yet.</li>
        ) : (
          sorted.map(r => (
            <li key={r.report_date}>
              <HistoryRow report={r} />
            </li>
          ))
        )}
      </ul>
    </main>
  )
}

function isoMinus(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}
