import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { NotificationTemplatesClient } from '@/components/settings/notification-templates-client'

export const metadata: Metadata = { title: 'Notification Templates' }

export default async function NotificationTemplatesPage() {
  const supabase = await createClient()
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
