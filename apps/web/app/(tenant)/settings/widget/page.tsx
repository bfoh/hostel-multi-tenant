import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { WidgetSettingsForm } from '@/components/settings/widget-settings-form'
import { ApiKeyPanel } from '@/components/settings/api-key-panel'

export const metadata: Metadata = { title: 'Widget Settings' }

export default async function WidgetSettingsPage() {
  const headersList = await headers()
  const tenantId    = headersList.get('x-tenant-id')

  const supabase = createAdminClient()
  const { data: tenantRaw } = await supabase
    .from('tenants')
    .select('slug, widget_domains, public_api_key')
    .eq('id', tenantId ?? '')
    .single()
  const tenant = tenantRaw as any

  const slug    = tenant?.slug ?? ''
  const domains = (tenant?.widget_domains ?? []) as string[]
  const apiKey  = tenant?.public_api_key as string | null ?? null

  // Determine widget script URL from request
  const host    = headersList.get('x-forwarded-host') ?? headersList.get('host') ?? 'yourhostel.com'
  const proto   = headersList.get('x-forwarded-proto') ?? 'https'
  const baseUrl = `${proto}://${host}`

  const floatingSnippet = `<script
  src="${baseUrl}/widget.js"
  data-hostel="${slug}"
  data-mode="floating"
  data-base-url="${baseUrl}"
  defer
></script>`

  const inlineSnippet = `<!-- Place this where you want the booking form to appear -->
<div id="booking-widget"></div>
<script
  src="${baseUrl}/widget.js"
  data-hostel="${slug}"
  data-mode="inline"
  data-target="#booking-widget"
  data-base-url="${baseUrl}"
  defer
></script>`

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/settings" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft className="h-4 w-4" /> Settings
        </Link>
        <span className="text-text-disabled">/</span>
        <span className="text-sm font-medium text-text-primary">Booking Widget</span>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-text-primary">Booking Widget</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Embed a self-service booking form on your hostel website.
        </p>
      </div>

      {/* Floating button snippet */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">Floating button (recommended)</h2>
        <p className="text-xs text-text-secondary">
          Adds a "Book a Room" button fixed to the bottom-right of your website.
        </p>
        <SnippetBox code={floatingSnippet} />
      </section>

      {/* Inline snippet */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">Inline embed</h2>
        <p className="text-xs text-text-secondary">
          Places the booking form directly inside a container element.
        </p>
        <SnippetBox code={inlineSnippet} />
      </section>

      {/* Domain whitelist */}
      <section className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Allowed domains</h2>
          <p className="mt-1 text-xs text-text-secondary">
            Leave blank to allow all origins (not recommended for production).
            Enter your website domain(s) to restrict widget access.
          </p>
        </div>
        <WidgetSettingsForm tenantId={tenantId ?? ''} initialDomains={domains} />
      </section>

      {/* API key */}
      <section className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Public API Key</h2>
          <p className="mt-1 text-xs text-text-secondary">
            Used to authenticate programmatic access to your hostel's public API.
          </p>
        </div>
        <ApiKeyPanel initialKey={apiKey} />
      </section>

      {/* Platform guide */}
      <section className="rounded-xl border border-border bg-surface p-5 space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">Platform guides</h2>
        <ul className="space-y-2 text-sm text-text-secondary">
          <li><span className="font-medium text-text-primary">WordPress:</span> Paste the snippet into your theme's <code className="font-mono text-xs bg-surface-raised px-1 py-0.5 rounded">footer.php</code> before <code className="font-mono text-xs bg-surface-raised px-1 py-0.5 rounded">&lt;/body&gt;</code>.</li>
          <li><span className="font-medium text-text-primary">Wix / Squarespace:</span> Use the "Custom Code" section in site settings → paste in head or footer.</li>
          <li><span className="font-medium text-text-primary">Webflow:</span> Site Settings → Custom Code → Footer Code.</li>
          <li><span className="font-medium text-text-primary">Plain HTML:</span> Paste anywhere before <code className="font-mono text-xs bg-surface-raised px-1 py-0.5 rounded">&lt;/body&gt;</code>.</li>
        </ul>
      </section>
    </div>
  )
}

function SnippetBox({ code }: { code: string }) {
  return (
    <div className="relative rounded-lg border border-border bg-[#0d1117] overflow-x-auto">
      <pre className="p-4 text-xs text-[#e6edf3] font-mono leading-relaxed whitespace-pre">{code}</pre>
    </div>
  )
}
