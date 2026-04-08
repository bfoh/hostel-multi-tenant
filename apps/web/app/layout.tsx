import type { Metadata, Viewport } from 'next'
import { Inter, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google'
import { headers } from 'next/headers'

import { ThemeProvider } from '@/components/providers/theme-provider'
import { TenantProvider } from '@/components/providers/tenant-provider'
import { QueryProvider } from '@/components/providers/query-provider'
import { Toaster } from '@/components/ui/toaster'
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

// ── Default metadata (tenant pages override via generateMetadata) ─────────────
export const metadata: Metadata = {
  title: {
    default: 'AbrempongHMS',
    template: '%s — AbrempongHMS',
  },
  description: 'Modern hostel management for Ghana.',
  applicationName: 'AbrempongHMS',
  keywords: ['hostel management', 'student accommodation', 'Ghana', 'HMS'],
  robots: { index: false, follow: false }, // default no-index; tenant pages opt-in
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0F0F0E' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const tenantId = headersList.get('x-tenant-id')
  const tenantSlug = headersList.get('x-tenant-slug')
  const tenantName = headersList.get('x-tenant-name')
  const tenantColor = headersList.get('x-tenant-color')

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontSans.variable} ${fontDisplay.variable} ${fontMono.variable}`}
    >
      <head>
        {/* Inject tenant primary color as CSS variable override */}
        {tenantColor && (
          <style
            dangerouslySetInnerHTML={{
              __html: `:root { --color-brand: ${tenantColor}; }`,
            }}
          />
        )}
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <TenantProvider
            tenantId={tenantId}
            tenantSlug={tenantSlug}
            tenantName={tenantName}
          >
            <QueryProvider>
              {children}
              <Toaster />
            </QueryProvider>
          </TenantProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
