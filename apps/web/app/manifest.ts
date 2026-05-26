import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GH Hostels',
    short_name: 'GH Hostels',
    description: 'Modern hostel management software for Ghana — bookings, MoMo, GRA accounting, payroll.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0A0A08',
    theme_color: '#0F4C3A',
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
