'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, CreditCard, Wrench, Bell, User } from 'lucide-react'

const TABS = [
  { href: '/occupant-portal',             label: 'Home',       Icon: Home       },
  { href: '/occupant-portal/payments',    label: 'Payments',   Icon: CreditCard  },
  { href: '/occupant-portal/maintenance', label: 'Requests',   Icon: Wrench     },
  { href: '/occupant-portal/notices',     label: 'Notices',    Icon: Bell       },
  { href: '/occupant-portal/profile',     label: 'Profile',    Icon: User       },
]

export function BottomNav({ color }: { color: string }) {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-2xl">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== '/occupant-portal' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-1 flex-col items-center gap-1 py-2.5 transition-opacity"
            >
              <Icon
                className="h-5 w-5 transition-colors"
                style={{ color: active ? color : '#94a3b8' }}
                strokeWidth={active ? 2.5 : 1.8}
              />
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
