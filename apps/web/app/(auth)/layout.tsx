import type { Metadata } from 'next'
import Image from 'next/image'
import { headers } from 'next/headers'

export const metadata: Metadata = {
  title: 'Sign in',
}

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const tenantName = headersList.get('x-tenant-name')
  const tenantLogoUrl = null // TODO: read from headers once we pass logo URL

  return (
    <div className="flex min-h-screen">
      {/* ── Left panel — branding ─────────────────────────────────── */}
      <div className="hidden w-1/2 flex-col justify-between bg-sidebar-bg p-12 lg:flex">
        <div className="flex items-center gap-3">
          {tenantLogoUrl ? (
            <Image src={tenantLogoUrl} alt={tenantName ?? 'Hostel'} width={40} height={40} />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand">
              <span className="font-display text-lg font-bold text-white">A</span>
            </div>
          )}
          <span className="font-display text-lg font-semibold text-white">
            {tenantName ?? 'AbrempongHMS'}
          </span>
        </div>

        <blockquote className="space-y-2">
          <p className="font-display text-xl font-medium leading-relaxed text-white/90">
            &ldquo;Managing our hostel used to take hours. Now our team handles everything from one
            screen — bookings, payments, housekeeping.&rdquo;
          </p>
          <footer className="text-sm text-white/50">
            Kwame Asante, Manager — Unity Hall, KNUST
          </footer>
        </blockquote>

        <p className="text-xs text-white/30">
          © {new Date().getFullYear()} AbrempongHMS. All rights reserved.
        </p>
      </div>

      {/* ── Right panel — form ────────────────────────────────────── */}
      <div className="flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2">
        {/* Mobile logo */}
        <div className="mb-8 flex items-center gap-2 lg:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand">
            <span className="font-display text-sm font-bold text-white">A</span>
          </div>
          <span className="font-display font-semibold text-text-primary">
            {tenantName ?? 'AbrempongHMS'}
          </span>
        </div>

        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  )
}
