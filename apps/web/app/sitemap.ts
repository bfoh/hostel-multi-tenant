import { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headersList = await headers()
  const host  = headersList.get('x-forwarded-host') ?? headersList.get('host') ?? 'localhost:3000'
  const proto = headersList.get('x-forwarded-proto') ?? 'https'
  const base  = `${proto}://${host}`

  const slug = headersList.get('x-tenant-slug')

  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'gh-hostels.com'
  const rootDomain = appDomain.startsWith('app.') ? appDomain.slice(4) : appDomain
  const isMarketing = host === rootDomain || host === `www.${rootDomain}`

  // ── Marketing site (root domain) ─────────────────────────────
  if (isMarketing) {
    const now = new Date()
    return [
      { url: `${base}/`,                     lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
      { url: `${base}/#features`,            lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
      { url: `${base}/#locations`,           lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
      { url: `${base}/#pricing`,             lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
      { url: `${base}/#faq`,                 lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
      { url: `${base}/compare/cloudbeds`,    lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
      { url: `${base}/compare/spreadsheet`,  lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    ]
  }

  // ── Tenant public booking surface ────────────────────────────
  const urls: MetadataRoute.Sitemap = [
    { url: `${base}/book`, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
  ]

  if (slug) {
    const supabase = createAdminClient()
    const { data: tenantRow } = await supabase.from('tenants').select('id').eq('slug', slug).single()
    if (tenantRow) {
      const { data: categories } = await supabase
        .from('room_categories')
        .select('id, updated_at')
        .eq('tenant_id', tenantRow.id)
        .eq('is_active', true)

      for (const cat of categories ?? []) {
        urls.push({
          url:             `${base}/book#${cat.id}`,
          lastModified:    new Date(cat.updated_at ?? Date.now()),
          changeFrequency: 'weekly',
          priority:        0.7,
        })
      }
    }
  }

  return urls
}
