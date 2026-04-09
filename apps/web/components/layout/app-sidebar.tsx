'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import {
  LayoutDashboard,
  Users,
  BedDouble,
  CalendarCheck,
  FileText,
  Sparkles,
  Wrench,
  DollarSign,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  HardHat,
  Shield,
  MessageSquare,
  UserCog,
  ClipboardList,
} from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/lib/utils'
import { useTenant } from '@/components/providers/tenant-provider'
import { initials } from '@/lib/utils'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  badge?: string
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',      href: '/dashboard',      icon: LayoutDashboard },
  { label: 'Occupants',      href: '/occupants',      icon: Users },
  { label: 'Rooms',          href: '/rooms',          icon: BedDouble },
  { label: 'Bookings',       href: '/bookings',       icon: CalendarCheck },
  { label: 'Invoices',       href: '/invoices',       icon: FileText },
  { label: 'Payments',       href: '/payments',       icon: DollarSign },
  { label: 'Housekeeping',   href: '/housekeeping',   icon: Wrench },
  { label: 'Staff',          href: '/staff',          icon: UserCog },
  { label: 'Maintenance',    href: '/maintenance',    icon: HardHat },
  { label: 'Security',       href: '/security',       icon: Shield },
  { label: 'Communications', href: '/communications', icon: MessageSquare },
  { label: 'Reports',        href: '/reports',        icon: BarChart3 },
  { label: 'Intelligence',   href: '/intelligence',   icon: Sparkles },
  { label: 'Activity log',   href: '/activity',       icon: ClipboardList },
]

const BOTTOM_ITEMS: NavItem[] = [
  { label: 'Settings', href: '/settings', icon: Settings },
]

interface AppSidebarProps {
  user: User
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname()
  const { tenantName } = useTenant()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        'sidebar-transition flex h-screen flex-col bg-sidebar-bg',
        collapsed ? 'w-sidebar-collapsed' : 'w-sidebar'
      )}
    >
      {/* ── Logo / hostel name ──────────────────────────────────── */}
      <div className="flex h-16 items-center justify-between px-4">
        {!collapsed && (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand">
              <span className="font-display text-sm font-bold text-white">
                {tenantName ? initials(tenantName) : 'A'}
              </span>
            </div>
            <span className="truncate font-display text-sm font-semibold text-white">
              {tenantName ?? 'AbrempongHMS'}
            </span>
          </div>
        )}
        {collapsed && (
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-brand">
            <span className="font-display text-sm font-bold text-white">
              {tenantName ? initials(tenantName) : 'A'}
            </span>
          </div>
        )}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="ml-auto rounded p-1 text-sidebar-text hover:bg-sidebar-item-hover hover:text-white transition-colors"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Main nav ─────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              collapsed={collapsed}
            />
          ))}
        </ul>
      </nav>

      {/* ── Bottom nav + collapse toggle ─────────────────────────── */}
      <div className="border-t border-white/10 px-2 py-2">
        <ul className="space-y-0.5">
          {BOTTOM_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              collapsed={collapsed}
            />
          ))}
        </ul>

        {/* User avatar */}
        <div className={cn('mt-3 flex items-center gap-2.5 rounded-lg px-2 py-2', collapsed && 'justify-center')}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white">
            {initials(user.email ?? 'U')}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="truncate text-xs font-medium text-white">{user.email}</p>
            </div>
          )}
        </div>

        {/* Expand toggle — show when collapsed */}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="mt-1 flex w-full items-center justify-center rounded p-1 text-sidebar-text hover:bg-sidebar-item-hover hover:text-white transition-colors"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </aside>
  )
}

function NavLink({
  item,
  pathname,
  collapsed,
}: {
  item: NavItem
  pathname: string
  collapsed: boolean
}) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
  const Icon = item.icon

  return (
    <li>
      <Link
        href={item.href}
        className={cn(
          'flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors',
          collapsed && 'justify-center px-2',
          isActive
            ? 'bg-sidebar-item-active text-sidebar-text-active font-medium'
            : 'text-sidebar-text hover:bg-sidebar-item-hover hover:text-sidebar-text-active'
        )}
        title={collapsed ? item.label : undefined}
      >
        <Icon className="h-4.5 w-4.5 shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
        {!collapsed && item.badge && (
          <span className="ml-auto rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-medium text-white">
            {item.badge}
          </span>
        )}
      </Link>
    </li>
  )
}
