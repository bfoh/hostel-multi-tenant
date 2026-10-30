import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Beddilo',
    short_name: 'Beddilo',
    description: 'Beddilo — a world of stays. Bookings, payments, accounting and payroll for your property.',
    start_url: '/',
    display: 'standalone',
    background_color: '#173B42',
    theme_color: '#173B42',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icons/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any' as any,
      },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    categories: ['business', 'productivity'],
    shortcuts: [
      {
        name: 'Bookings',
        url: '/bookings',
        description: 'View and manage bookings',
      },
      {
        name: 'Occupants',
        url: '/occupants',
        description: 'View and manage occupants',
      },
      {
        name: 'Maintenance',
        url: '/maintenance',
        description: 'View maintenance requests',
      },
    ],
  }
}
