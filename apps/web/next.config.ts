import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  experimental: {
    // Enable React 19 features
    ppr: false,
  },

  images: {
    remotePatterns: [
      // Supabase Storage
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      // Tenant custom image domains (CDN)
      {
        protocol: 'https',
        hostname: '*.gh-hostels.com',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self), geolocation=(self)',
          },
        ],
      },
      // Allow embedding in tenant websites (for the booking widget page only)
      {
        source: '/widget(.*)',
        headers: [{ key: 'X-Frame-Options', value: 'ALLOWALL' }],
      },
    ]
  },

  // Redirect root to platform landing or tenant dashboard based on context
  async redirects() {
    return []
  },
}

export default withSentryConfig(nextConfig, {
  // Source-map upload only runs when SENTRY_AUTH_TOKEN is present
  // (i.e. in CI/Vercel build), so local dev is unaffected.
  org:    process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent:  !process.env.CI,

  // Strip Sentry SDK logger statements from the client bundle.
  disableLogger: true,

  // Tunnel through a same-origin route so ad-blockers don't drop events.
  tunnelRoute: '/monitoring',

  // Don't fail the build if source-map upload can't reach Sentry.
  errorHandler: (err) => {
    // eslint-disable-next-line no-console
    console.warn('[sentry] source-map upload failed:', err.message)
  },
})
