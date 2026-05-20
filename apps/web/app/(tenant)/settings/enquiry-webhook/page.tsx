import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { EnquiryWebhookClient } from '@/components/settings/enquiry-webhook-client'

export const metadata: Metadata = { title: 'Website Enquiry Webhook' }
export const dynamic = 'force-dynamic'

export default async function EnquiryWebhookPage() {
  const tenantId = await getServerTenantId()
  if (!tenantId) notFound()

  const supabase = createAdminClient()
  const { data } = await (supabase
    .from('tenants') as any)
    .select('slug, website_url, enquiry_webhook_secret')
    .eq('id', tenantId)
    .single()

  if (!data) notFound()

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL
    ?? `https://${process.env.NEXT_PUBLIC_APP_DOMAIN ?? process.env.APP_DOMAIN ?? 'gh-hostels.com'}`
  const webhookUrl = `${appUrl}/api/webhooks/enquiry/${data.slug}`

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary"
        >
          <ChevronLeft className="h-3 w-3" />
          Back to Settings
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-text-primary">Website Enquiry Webhook</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Lets external form services (Readdy.ai, FormBold, Zapier, custom scripts) post enquiries
          straight into the dashboard. Submissions appear under{' '}
          <Link href="/waiting-list?source=website" className="text-brand underline">
            Waiting List & Enquiries
          </Link>{' '}
          with the <strong>Website</strong> source.
        </p>
      </div>

      <EnquiryWebhookClient
        webhookUrl={webhookUrl}
        secret={(data.enquiry_webhook_secret as string | null) ?? ''}
        websiteUrl={(data.website_url as string | null) ?? null}
      />
    </div>
  )
}
