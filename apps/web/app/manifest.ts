import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GH Hostels',
    short_name: 'GH Hostels',
    description: 'Modern hostel management for Ghana.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2563EB',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icons/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any' as any,
      },
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
