import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDailyReport } from '@/lib/reports/daily'
import { DigestCard } from '../_components/digest-card'

export const metadata: Metadata = { title: 'Digest' }
export const dynamic = 'force-dynamic'

interface PageProps { params: Promise<{ date: string }> }

export default async function OwnerDigestDayPage({ params }: PageProps) {
  const { date } = await params
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound()

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

  const report = await getDailyReport(tenantId, date)
  if (!report) notFound()

  const prevReport = await getDailyReport(tenantId, isoMinus(date, 1))

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <Link href="/owner-digest/history" className="flex items-center gap-1 text-sm text-slate-500">
          <ChevronLeft className="h-4 w-4" /> History
        </Link>
        <h1 className="text-base font-semibold text-slate-900">{date}</h1>
        <span className="w-16" />
      </header>
      <DigestCard report={report} yesterday={prevReport ?? null} />
    </main>
  )
}

function isoMinus(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}
