import type { Metadata } from 'next'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import Link from 'next/link'
import { ReportSchedulesClient } from '@/components/reports/report-schedules-client'

export const metadata: Metadata = { title: 'Report Schedules' }

export default async function ReportSchedulesPage() {
  const supabase = await createTenantAdminClientFromHeaders()
  const { data: schedules } = await supabase
    .from('report_schedules')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Report Schedules</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            Automatically email CSV reports to recipients on a schedule
          </p>
        </div>
        <Link href="/reports" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
          ← Reports
        </Link>
      </div>
      <ReportSchedulesClient initialSchedules={(schedules ?? []) as any} />
    </div>
  )
}
