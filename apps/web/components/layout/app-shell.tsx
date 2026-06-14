'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

import { AppSidebar } from './app-sidebar'
import { AppHeader } from './app-header'
import { cn } from '@/lib/utils'

interface AppShellProps {
  user: User
  tenantRole: string
  tenantId: string
  initialDraftCount: number
  initialEnquiryCount: number
  isImpersonating: boolean
  trialBanner?: React.ReactNode
  children: React.ReactNode
}

/**
 * App chrome wrapper. On desktop the sidebar is a static column; on mobile it
 * becomes an off-canvas drawer toggled by the header hamburger, with a scrim
 * and body-scroll lock. Closes automatically on navigation.
 */
export function AppShell({
  user,
  tenantRole,
  tenantId,
  initialDraftCount,
  initialEnquiryCount,
  isImpersonating,
  trialBanner,
  children,
}: AppShellProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Close the drawer whenever the route changes.
  useEffect(() => { setOpen(false) }, [pathname])

  // Lock body scroll + close on Escape while the drawer is open.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      {isImpersonating && (
        <div className="fixed top-0 inset-x-0 z-[60] bg-red-600 text-white text-xs font-medium flex items-center justify-between px-4 py-1.5">
          <span className="truncate">Super-admin impersonating</span>
          <a href="/api/admin/impersonate/clear" className="underline hover:no-underline shrink-0">Exit →</a>
        </div>
      )}

      {/* Mobile scrim */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden="true"
        className={cn(
          'fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 md:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      {/* Sidebar — single instance: off-canvas drawer on mobile, static column on desktop */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-out',
          'md:static md:z-auto md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <AppSidebar
          user={user}
          tenantRole={tenantRole}
          tenantId={tenantId}
          initialDraftCount={initialDraftCount}
          initialEnquiryCount={initialEnquiryCount}
        />
      </div>

      {/* Main column */}
      <div className={cn('flex min-w-0 flex-1 flex-col overflow-hidden', isImpersonating && 'mt-8')}>
        <AppHeader user={user} onMenuClick={() => setOpen(true)} />
        {trialBanner}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
