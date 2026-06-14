'use client'

import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { Bell, Sun, Moon, LogOut, Menu } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import { useTenant } from '@/components/providers/tenant-provider'
import { cn } from '@/lib/utils'

interface AppHeaderProps {
  user: User
  onMenuClick?: () => void
}

export function AppHeader({ user: _, onMenuClick }: AppHeaderProps) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { tenantName } = useTenant()
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleSignOut() {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="flex h-14 items-center justify-between gap-1 border-b border-border bg-surface px-3 sm:px-4">
      {/* Mobile: hamburger + hostel name */}
      <div className="flex min-w-0 items-center gap-2 md:hidden">
        <button
          onClick={onMenuClick}
          aria-label="Open menu"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-raised hover:text-text-primary transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="truncate text-sm font-semibold text-text-primary">{tenantName ?? ''}</span>
      </div>

      {/* Right-aligned actions */}
      <div className="flex items-center gap-1 md:ml-auto">
      {/* Theme toggle */}
      <button
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className={cn(
          'group flex h-8 w-8 items-center justify-center rounded-md text-text-secondary',
          'hover:bg-surface-raised hover:text-text-primary transition-all duration-200'
        )}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? (
          <Sun className="h-4 w-4 transition-transform duration-200 group-hover:scale-110 group-hover:rotate-12" />
        ) : (
          <Moon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110 group-hover:rotate-[-12deg]" />
        )}
      </button>

      {/* Notifications */}
      <button
        className={cn(
          'group relative flex h-8 w-8 items-center justify-center rounded-md text-text-secondary',
          'hover:bg-surface-raised hover:text-text-primary transition-all duration-200'
        )}
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4 transition-transform duration-200 group-hover:scale-110 group-hover:rotate-12" />
        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-danger" />
      </button>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        disabled={loggingOut}
        className={cn(
          'group flex h-8 w-8 items-center justify-center rounded-md text-text-secondary',
          'hover:bg-surface-raised hover:text-text-primary transition-all duration-200',
          'disabled:opacity-50'
        )}
        aria-label="Sign out"
      >
        <LogOut className="h-4 w-4 transition-transform duration-200 group-hover:scale-110 group-hover:translate-x-0.5" />
      </button>
      </div>
    </header>
  )
}
