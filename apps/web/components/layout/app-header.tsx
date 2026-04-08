'use client'

import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { Bell, Sun, Moon, LogOut } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface AppHeaderProps {
  user: User
}

export function AppHeader({ user: _ }: AppHeaderProps) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleSignOut() {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="flex h-14 items-center justify-end gap-1 border-b border-border bg-surface px-4">
      {/* Theme toggle */}
      <button
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-md text-text-secondary',
          'hover:bg-surface-raised hover:text-text-primary transition-colors'
        )}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
      </button>

      {/* Notifications */}
      <button
        className={cn(
          'relative flex h-8 w-8 items-center justify-center rounded-md text-text-secondary',
          'hover:bg-surface-raised hover:text-text-primary transition-colors'
        )}
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {/* Unread dot — replace with real count */}
        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-danger" />
      </button>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        disabled={loggingOut}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-md text-text-secondary',
          'hover:bg-surface-raised hover:text-text-primary transition-colors',
          'disabled:opacity-50'
        )}
        aria-label="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </header>
  )
}
