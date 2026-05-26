import type { Metadata } from 'next'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import Link from 'next/link'
import { NotificationTemplatesClient } from '@/components/settings/notification-templates-client'
import { getServerTenantId } from '@/lib/auth/tenant'
import { DEFAULT_TEMPLATES } from '@/lib/notifications/defaults'

export const metadata: Metadata = { title: 'Notification Templates' }

export default async function NotificationTemplatesPage() {
  const supabase  = await createTenantAdminClientFromHeaders()
  const tenantId  = await getServerTenantId()

  // Auto-seed defaults on first visit so the page is populated out of the box.
  if (tenantId) {
    const { count } = await supabase
      .from('notification_templates')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)

    if ((count ?? 0) === 0) {
      const rows = DEFAULT_TEMPLATES.map((t) => ({
        tenant_id:  tenantId,
        event_type: t.event_type,
        channel:    t.channel,
        subject:    t.subject ?? null,
        body:       t.body,
        is_active:  true,
      }))
      await supabase
        .from('notification_templates')
        .upsert(rows, { onConflict: 'tenant_id,event_type,channel' })
    }
  }

  const { data: templates } = await supabase
    .from('notification_templates')
    .select('*')
    .order('event_type')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Notification Templates</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            Customise SMS and email messages sent to occupants
          </p>
        </div>
        <Link href="/settings" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
          ← Settings
        </Link>
      </div>
      <NotificationTemplatesClient initialTemplates={(templates ?? []) as any} />
    </div>
  )
}
