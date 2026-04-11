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

  const urls: MetadataRoute.Sitemap = [
    { url: `${base}/book`, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
  ]

  if (slug) {
    // Add active room category anchors
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
