import type { NextConfig } from 'next'

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

export default nextConfig
