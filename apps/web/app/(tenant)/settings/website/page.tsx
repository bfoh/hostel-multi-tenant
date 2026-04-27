import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { ChevronLeft, ExternalLink } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { WebsiteCmsForm } from '@/components/settings/website-cms-form'

export const metadata: Metadata = { title: 'Website Content' }

export default async function WebsiteCmsPage() {
  const headersList = await headers()
  const tenantId    = headersList.get('x-tenant-id')
  const tenantSlug  = headersList.get('x-tenant-slug') ?? ''

  if (!tenantId) return null

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('tenants')
    .select('website_content, slug')
    .eq('id', tenantId)
    .single()

  const content = ((data as any)?.website_content ?? {}) as {
    hero_heading?:    string | null
    hero_subheading?: string | null
    about_text?:      string | null
    amenities?:       string[]
    gallery_urls?:    string[]
    faqs?:            { q: string; a: string }[]
  }

  const publicUrl = `${tenantSlug}.ghh.com/book`

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link
          href="/settings"
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Settings
        </Link>
        <span className="text-text-disabled">/</span>
        <span className="text-sm font-medium text-text-primary">Website Content</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Website Content</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Manage the content shown on your public booking page.
          </p>
        </div>
        <a
          href={`https://${publicUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-secondary hover:bg-surface-raised transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Preview page
        </a>
      </div>

      {/* ISR note */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
        Changes are saved immediately and will appear on your public page within 5 minutes (ISR cache).
      </div>

      <WebsiteCmsForm initial={content} />
    </div>
  )
}
