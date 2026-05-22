import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDailyReport, getTenantToday } from '@/lib/reports/daily'
import { DigestCard } from './_components/digest-card'

export const metadata: Metadata = { title: 'Daily digest' }
export const dynamic = 'force-dynamic'

/**
 * Today's digest for tenant owners on the mobile app.
 *
 * Layout already gated to owner role; here we resolve the tenant from
 * the current user's tenant_members row (more reliable than x-tenant-id
 * on cold mobile launch — same approach as getOccupantSession).
 */
export default async function OwnerDigestTodayPage() {
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

  const today          = await getTenantToday(tenantId)
  const yesterdayIso   = isoMinus(today, 1)
  const [todayReport, yesterdayReport] = await Promise.all([
    getDailyReport(tenantId, today),
    getDailyReport(tenantId, yesterdayIso),
  ])

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Today</h1>
        <Link href="/owner-digest/history" className="text-sm font-medium text-blue-600">
          History
        </Link>
      </header>

      {todayReport ? (
        <DigestCard report={todayReport} yesterday={yesterdayReport ?? null} />
      ) : (
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-600">
            Today's digest has not been computed yet. It will appear after the
            tenant's configured digest time.
          </p>
          <Link
            href="/owner-digest/history"
            className="mt-4 inline-block text-sm font-medium text-blue-600"
          >
            View past digests →
          </Link>
        </div>
      )}
    </main>
  )
}

function isoMinus(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}
