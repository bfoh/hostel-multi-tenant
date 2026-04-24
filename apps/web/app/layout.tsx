import type { Metadata, Viewport } from 'next'
import { Inter, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google'
import { headers } from 'next/headers'

import { TenantProvider } from '@/components/providers/tenant-provider'
import { QueryProvider } from '@/components/providers/query-provider'
import { AuthTokenHandler } from '@/components/providers/auth-token-handler'
import { Toaster } from '@/components/ui/toaster'
import { ServiceWorkerRegister } from '@/components/pwa/service-worker-register'
import '@/app/globals.css'

// ── Font loading ─────────────────────────────────────────────────────────────
const fontSans = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-sans',
  display: 'swap',
})

const fontDisplay = Plus_Jakarta_Sans({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-display',
  weight: ['500', '600', '700', '800'],
  display: 'swap',
})

const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
  display: 'swap',
})

// ── Metadata ─────────────────────────────────────────────────────────────────
// When a tenant is resolved (via middleware injecting x-tenant-* headers),
// rebrand the tab title, applicationName, and favicon to the tenant. Falls
// back to the platform identity on the marketing / auth / portal pages.
export async function generateMetadata(): Promise<Metadata> {
  const headersList  = await headers()
  const tenantName   = headersList.get('x-tenant-name')
  const tenantLogo   = headersList.get('x-tenant-logo')
  const tenantFavicon = headersList.get('x-tenant-favicon')

  const brand = tenantName?.trim() || 'GH Hostels'
  // Prefer an explicit favicon; fall back to the tenant's logo (browsers
  // gracefully downscale PNG/SVG for the tab icon); otherwise platform SVG.
  const iconHref = tenantFavicon || tenantLogo || '/icons/icon.svg'
  const appleIconHref = tenantLogo || tenantFavicon || '/icons/icon.svg'

  return {
    title: {
      default: brand,
      template: `%s — ${brand}`,
    },
    description: tenantName ? `${brand} — hostel management dashboard.` : 'Modern hostel management for Ghana.',
    applicationName: brand,
    keywords: ['hostel management', 'student accommodation', 'Ghana', 'HMS'],
    robots: { index: false, follow: false }, // default no-index; tenant pages opt-in
    manifest: '/manifest.webmanifest',
    appleWebApp: {
      capable: true,
      title: brand,
      statusBarStyle: 'default',
    },
    formatDetection: { telephone: false },
    icons: {
      icon: iconHref,
      apple: appleIconHref,
    },
  }
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0F0F0E' },
  ],
  width: 'device-width',
  initialScale: 1,
}

/** Convert a #rrggbb hex string to HSL components string "H S% L%" */
function hexToHslComponents(hex: string): string | null {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return null
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  const hDeg = Math.round(h * 360)
  const sPct = Math.round(s * 100)
  const lPct = Math.round(l * 100)
  return `${hDeg} ${sPct}% ${lPct}%`
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  const tenantSlug = headersList.get('x-tenant-slug')
  const tenantName = headersList.get('x-tenant-name')
  const tenantColor = headersList.get('x-tenant-color')
  const tenantLogo = headersList.get('x-tenant-logo')

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontSans.variable} ${fontDisplay.variable} ${fontMono.variable}`}
    >
      <head>
        {/* Inject tenant primary color as CSS variable override */}
        {tenantColor && (() => {
          // tenantColor from DB is hex (#1B4F72). CSS variable must be HSL
          // components (without hsl() wrapper) because Tailwind uses hsl(var(...)).
          const hsl = tenantColor.startsWith('#')
            ? hexToHslComponents(tenantColor)
            : tenantColor // already HSL components
          if (!hsl) return null
          // Derive a slightly darker hover shade
          const [hDeg, sPct, lRaw] = hsl.split(/[\s%]+/).map(Number)
          const lHover = Math.max(lRaw - 6, 5)
          const css = [
            `--color-brand: ${hDeg} ${sPct}% ${lRaw}%;`,
            `--color-brand-hover: ${hDeg} ${sPct}% ${lHover}%;`,
            `--color-brand-active: ${hDeg} ${sPct}% ${Math.max(lRaw - 12, 5)}%;`,
            `--color-brand-subtle: ${hDeg} ${sPct}% 95%;`,
            `--color-sidebar-item-active: ${hDeg} ${sPct}% ${Math.max(lRaw - 8, 10)}%;`,
          ].join(' ')
          return (
            <style dangerouslySetInnerHTML={{ __html: `:root { ${css} }` }} />
          )
        })()}
        {/*
         * Favicon + apple-touch-icon are emitted by generateMetadata() above,
         * which already picks tenant favicon_url / logo_url / platform default.
         */}
      </head>
      <body>
        <TenantProvider
          tenantId={tenantId}
          tenantSlug={tenantSlug}
          tenantName={tenantName}
          tenantLogo={tenantLogo}
        >
          <QueryProvider>
            <AuthTokenHandler />
            {children}
            <Toaster />
            <ServiceWorkerRegister />
          </QueryProvider>
        </TenantProvider>
      </body>
    </html>
  )
}
