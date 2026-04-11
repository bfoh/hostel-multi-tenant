import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, Globe } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTenantId } from '@/lib/auth/tenant'
import { DomainForm } from '@/components/settings/domain-form'

export const metadata: Metadata = { title: 'Custom Domain' }

export default async function DomainSettingsPage() {
  const tenantId = await getServerTenantId()

  const supabase = createAdminClient()
  const { data: tenant } = await supabase
    .from('tenants')
    .select('slug, custom_domain')
    .eq('id', tenantId ?? '')
    .single()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/settings" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft className="h-4 w-4" /> Settings
        </Link>
        <span className="text-text-disabled">/</span>
        <span className="text-sm font-medium text-text-primary">Custom Domain</span>
      </div>

      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10">
          <Globe className="h-5 w-5 text-brand" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Custom Domain</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Serve your public booking page and app on your own domain with automatic SSL.
          </p>
        </div>
      </div>

      <DomainForm
        slug={tenant?.slug ?? ''}
        initialDomain={tenant?.custom_domain ?? null}
      />
    </div>
  )
}
