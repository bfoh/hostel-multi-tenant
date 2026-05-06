'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, CreditCard, FileText, Utensils, Wrench, Bell, User } from 'lucide-react'

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

const BASE_TABS: TabDef[] = [
  { href: '/occupant-portal',             label: 'Home',       Icon: Home,       anim: 'pulse'  },
  { href: '/occupant-portal/payments',    label: 'Payments',   Icon: CreditCard, anim: 'flip'   },
  { href: '/occupant-portal/invoices',    label: 'Invoices',   Icon: FileText,   anim: 'slide'  },
  { href: '/occupant-portal/maintenance', label: 'Requests',   Icon: Wrench,     anim: 'swing'  },
  { href: '/occupant-portal/notices',     label: 'Notices',    Icon: Bell,       anim: 'ring'   },
  { href: '/occupant-portal/profile',     label: 'Profile',    Icon: User,       anim: 'bounce' },
]

const FOOD_TAB: TabDef = {
  href: '/occupant-portal/food', label: 'Food', Icon: Utensils, anim: 'pop',
}

export function BottomNav({ color, foodEnabled = false }: { color: string; foodEnabled?: boolean }) {
  const pathname = usePathname()
  // Insert Food between Invoices and Requests when enabled
  const TABS: TabDef[] = foodEnabled
    ? [...BASE_TABS.slice(0, 3), FOOD_TAB, ...BASE_TABS.slice(3)]
    : BASE_TABS

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-2xl">
        {TABS.map(({ href, label, Icon, anim }) => {
          const active = pathname === href || (href !== '/occupant-portal' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`${ANIM_CLASS[anim]} flex flex-1 flex-col items-center gap-1 py-2.5 transition-opacity`}
            >
              <span className="sb-icon relative flex shrink-0 items-center justify-center" style={{ perspective: '600px' }}>
                <Icon
                  className="h-5 w-5 transition-colors"
                  style={{ color: active ? color : '#94a3b8' }}
                  strokeWidth={active ? 2.5 : 1.8}
                />
              </span>
              <span
                className="text-[10px] font-medium transition-colors"
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
