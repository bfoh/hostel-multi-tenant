'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, CalendarCheck, Wallet, Store, MoreHorizontal } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type IconAnim = 'bounce' | 'shake' | 'spin' | 'pulse' | 'swing' | 'ring' | 'slide' | 'flip' | 'tilt' | 'pop'

const ANIM_CLASS: Record<IconAnim, string> = {
  bounce: 'sb-anim-bounce',
  shake:  'sb-anim-shake',
  spin:   'sb-anim-spin',
  pulse:  'sb-anim-pulse',
  swing:  'sb-anim-swing',
  ring:   'sb-anim-ring',
  slide:  'sb-anim-slide',
  flip:   'sb-anim-flip',
  tilt:   'sb-anim-tilt',
  pop:    'sb-anim-pop',
}

interface TabDef {
  href:  string
  label: string
  Icon:  React.ComponentType<{ className?: string; style?: React.CSSProperties; strokeWidth?: number }>
  anim:  IconAnim
}

const TABS: TabDef[] = [
  { href: '/owner-mobile',          label: 'Today',    Icon: Home,          anim: 'pulse'  },
  { href: '/owner-mobile/bookings', label: 'Bookings',  Icon: CalendarCheck, anim: 'slide'  },
  { href: '/owner-mobile/finance',  label: 'Finance',   Icon: Wallet,        anim: 'flip'   },
  { href: '/owner-mobile/listing',  label: 'Listing',   Icon: Store,         anim: 'swing'  },
  { href: '/owner-mobile/more',     label: 'More',      Icon: MoreHorizontal, anim: 'bounce' },
]

export function OwnerMobileBottomNav({ color, userId }: { color: string; userId: string }) {
  const pathname = usePathname()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function refresh() {
      try {
        const res = await fetch('/api/messages/conversations', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const total = Array.isArray(data)
          ? data.reduce((s: number, i: any) => s + (i.unread_count ?? 0), 0)
          : 0
        if (!cancelled) setUnreadCount(total)
      } catch {
        // ignore
      }
    }
    refresh()
    const sb = createClient()
    const ch = sb.channel(`owner-mobile-unread:${userId}`)
      .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' },
          () => refresh())
      .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'conversation_participants',
            filter: `user_id=eq.${userId}` },
          () => refresh())
      .subscribe()
    return () => { cancelled = true; sb.removeChannel(ch) }
  }, [userId])

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-200/80 bg-white/85 backdrop-blur-xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-2xl px-1">
        {TABS.map(({ href, label, Icon, anim }) => {
          const active = pathname === href || (href !== '/owner-mobile' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`${ANIM_CLASS[anim]} group relative flex flex-1 flex-col items-center gap-1 pt-2 pb-2 transition-all`}
            >
              <span
                className="sb-icon relative flex h-8 w-full max-w-[52px] shrink-0 items-center justify-center rounded-full transition-all duration-200"
                style={{
                  perspective: '600px',
                  backgroundColor: active ? `${color}16` : 'transparent',
                }}
              >
                <Icon
                  className="h-[18px] w-[18px] transition-colors"
                  style={{ color: active ? color : '#94a3b8' }}
                  strokeWidth={active ? 2.5 : 1.9}
                />
                {href === '/owner-mobile/more' && unreadCount > 0 && (
                  <span className="absolute -top-0.5 right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </span>
              <span
                className="text-[10px] font-semibold leading-none transition-colors"
                style={{ color: active ? color : '#94a3b8' }}
              >
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
