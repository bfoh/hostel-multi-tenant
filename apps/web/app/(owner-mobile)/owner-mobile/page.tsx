import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveMobileContext } from '@/lib/auth/mobile-context'
import { getDailyReport, getTenantToday } from '@/lib/reports/daily'
import { DigestCard } from '@/app/(tenant)/owner-digest/_components/digest-card'

export const metadata: Metadata = { title: 'Today · Owner' }
export const dynamic = 'force-dynamic'

export default async function OwnerMobileTodayPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await resolveMobileContext(user.id)
  if (ctx.role !== 'owner' || !ctx.tenantId) redirect('/login')
  const tenantId: string = ctx.tenantId

  const today        = await getTenantToday(tenantId)
  const yesterdayIso = isoMinus(today, 1)
  const [todayReport, yesterdayReport] = await Promise.all([
    getDailyReport(tenantId, today),
    getDailyReport(tenantId, yesterdayIso),
  ])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-800">Today</h1>
        <Link href="/owner-digest/history" className="text-sm font-medium text-blue-600">
          History
        </Link>
      </div>

      {todayReport ? (
        <DigestCard report={todayReport} yesterday={yesterdayReport ?? null} />
      ) : (
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-600">
            Today&apos;s digest has not been computed yet. It will appear after the
            tenant&apos;s configured digest time.
          </p>
          <Link href="/owner-digest/history" className="mt-4 inline-block text-sm font-medium text-blue-600">
            View past digests →
          </Link>
        </div>
      )}
    </div>
  )
}

function isoMinus(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}
