import type { Metadata } from 'next'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { NoticesClient } from '@/components/communications/notices-client'

export const metadata: Metadata = { title: 'Notice Board' }

export default async function NoticesPage() {
  const supabase = await createTenantAdminClientFromHeaders()
  const notices: any[] = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data } = await supabase
      .from('notices')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('published_at', { ascending: false })
      .range(from, from + pageSize - 1)
    notices.push(...(data ?? []))
    if ((data ?? []).length < pageSize) break
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Notice Board</h1>
        <p className="mt-0.5 text-sm text-text-secondary">Post announcements visible on the occupant portal</p>
      </div>
      <NoticesClient initialNotices={notices as any} />
    </div>
  )
}
