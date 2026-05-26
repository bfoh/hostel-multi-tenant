import type { Metadata } from 'next'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { NoticesClient } from '@/components/communications/notices-client'

export const metadata: Metadata = { title: 'Notice Board' }

export default async function NoticesPage() {
  const supabase = await createTenantAdminClientFromHeaders()
  const { data: notices } = await supabase
    .from('notices')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(100)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Notice Board</h1>
        <p className="mt-0.5 text-sm text-text-secondary">Post announcements visible on the occupant portal</p>
      </div>
      <NoticesClient initialNotices={(notices ?? []) as any} />
    </div>
  )
}
