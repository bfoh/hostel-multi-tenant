import type { Metadata } from 'next'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import { WebhooksClient } from '@/components/settings/webhooks-client'

export const metadata: Metadata = { title: 'Webhooks' }

export default async function WebhooksPage() {
  const supabase = await createTenantAdminClientFromHeaders()

  const { data: endpoints } = await supabase
    .from('webhook_endpoints')
    .select('id, url, events, description, is_active, created_at')
    .order('created_at', { ascending: false })

  const { data: events } = await supabase
    .from('webhook_events')
    .select('id, endpoint_id, event_type, status, response_status, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Webhooks</h1>
        <p className="mt-0.5 text-sm text-text-secondary">
          Send real-time HTTP events to external systems when things happen in GH Hostels.
        </p>
      </div>
      <WebhooksClient initialEndpoints={(endpoints ?? []) as any} initialEvents={(events ?? []) as any} />
    </div>
  )
}
