import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'

export const revalidate = 3600

export default async function robots(): Promise<MetadataRoute.Robots> {
  const headersList = await headers()
  const host  = headersList.get('x-forwarded-host') ?? headersList.get('host') ?? 'gh-hostels.com'
  const proto = headersList.get('x-forwarded-proto') ?? 'https'
  const base  = `${proto}://${host}`

  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'gh-hostels.com'
  const rootDomain = appDomain.startsWith('app.') ? appDomain.slice(4) : appDomain

  // Marketing root domain: allow indexing of public pages.
  // Tenant subdomains / app domain: disallow everything (private SaaS).
  const isMarketing =
    host === rootDomain || host === `www.${rootDomain}`

  if (!isMarketing) {
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
      sitemap: `${base}/sitemap.xml`,
    }
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/'],
        disallow: [
          '/api/',
          '/auth/',
          '/dashboard',
          '/admin',
          '/onboarding',
          '/suspended',
          '/login',
          '/signup',
        ],
      },
      // Crawl budget hint for major bots
      { userAgent: 'Googlebot', allow: '/' },
      { userAgent: 'Bingbot', allow: '/' },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
