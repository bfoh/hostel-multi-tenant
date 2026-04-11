'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import {
  LayoutDashboard, Users, BedDouble, CalendarCheck,
  FileText, Sparkles, Wrench, DollarSign, BarChart3,
  Settings, ChevronLeft, ChevronRight, HardHat, Shield,
  MessageSquare, UserCog, ClipboardList, BookOpen, Bot,
  Package, Search, Building2, ListOrdered, TrendingDown,
  Monitor, Lock,
} from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/lib/utils'
import { useTenant } from '@/components/providers/tenant-provider'
import { initials } from '@/lib/utils'

// ── Role helpers ─────────────────────────────────────────────────────────────

const ADMIN_ROLES = new Set(['owner', 'manager', 'admin'])

export function isAdminRole(role: string) {
  return ADMIN_ROLES.has(role)
}

// ── Nav structure ────────────────────────────────────────────────────────────

interface NavItem {
  label: string
  href:  string
  icon:  React.ElementType
  badge?: string
}

/** Day-to-day operations — visible to ALL authenticated roles (staff + admin) */
const OPS_ITEMS: NavItem[] = [
  { label: 'Dashboard',      href: '/dashboard',      icon: LayoutDashboard },
  { label: 'Occupants',      href: '/occupants',      icon: Users           },
  { label: 'Rooms',          href: '/rooms',           icon: BedDouble       },
  { label: 'Bookings',       href: '/bookings',        icon: CalendarCheck   },
  { label: 'Housekeeping',   href: '/housekeeping',    icon: Wrench          },
  { label: 'Maintenance',    href: '/maintenance',     icon: HardHat         },
  { label: 'Kiosk',          href: '/kiosk',           icon: Monitor         },
  { label: 'Lost & Found',   href: '/lost-found',      icon: Search          },
  { label: 'Communications', href: '/communications',  icon: MessageSquare   },
  { label: 'Security',       href: '/security',        icon: Shield          },
]

/** Sensitive management — visible to owner / manager / admin ONLY */
const ADMIN_ITEMS: NavItem[] = [
  { label: 'Portfolio',      href: '/portfolio',           icon: Building2   },
  { label: 'Invoices',       href: '/invoices',            icon: FileText    },
  { label: 'Payments',       href: '/payments',            icon: DollarSign  },
  { label: 'Accounting',     href: '/accounting',          icon: BookOpen    },
  { label: 'Expenses',       href: '/accounting/expenses', icon: TrendingDown},
  { label: 'Staff',          href: '/staff',               icon: UserCog     },
  { label: 'Assets',         href: '/assets',              icon: Package     },
  { label: 'Waiting List',   href: '/waiting-list',        icon: ListOrdered },
  { label: 'Reports',        href: '/reports',             icon: BarChart3   },
  { label: 'Intelligence',   href: '/intelligence',        icon: Sparkles    },
  { label: 'AI Assistant',   href: '/ai',                  icon: Bot         },
  { label: 'Activity log',   href: '/activity',            icon: ClipboardList},
]

const BOTTOM_ITEMS: NavItem[] = [
  { label: 'Settings', href: '/settings', icon: Settings },
]

// ── Component ────────────────────────────────────────────────────────────────

interface AppSidebarProps {
  user:       User
  tenantRole: string   // from x-tenant-role header
}

export function AppSidebar({ user, tenantRole }: AppSidebarProps) {
  const pathname   = usePathname()
  const { tenantName, tenantLogo } = useTenant()
  const [collapsed, setCollapsed] = useState(false)

  const isAdmin = isAdminRole(tenantRole)

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
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-item-active shadow-sm overflow-hidden">
              {tenantLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tenantLogo} alt="" className="h-8 w-8 object-cover" />
              ) : tenantName ? (
                <span className="font-display text-sm font-bold text-white">{initials(tenantName)}</span>
              ) : (
                <BuildingIcon />
              )}
            </div>
            <span className="truncate font-display text-sm font-semibold text-white">
              {tenantName ?? 'GH Hostels'}
            </span>
          </div>
        )}
        {collapsed && (
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-item-active shadow-sm overflow-hidden">
            {tenantLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tenantLogo} alt="" className="h-8 w-8 object-cover" />
            ) : tenantName ? (
              <span className="font-display text-sm font-bold text-white">{initials(tenantName)}</span>
            ) : (
              <BuildingIcon />
            )}
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
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-4">

        {/* Operations — all roles */}
        <section>
          {!collapsed && (
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-white/30">
              Operations
            </p>
          )}
          <ul className="space-y-0.5">
            {OPS_ITEMS.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
            ))}
          </ul>
        </section>

        {/* Admin — owner / manager only */}
        {isAdmin ? (
          <section>
            {!collapsed && (
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                Admin
              </p>
            )}
            {collapsed && (
              <div className="my-1 mx-2 border-t border-white/10" />
            )}
            <ul className="space-y-0.5">
              {ADMIN_ITEMS.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
              ))}
            </ul>
          </section>
        ) : (
          /* Locked section indicator for staff */
          !collapsed && (
            <section>
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                Admin
              </p>
              <div className="flex items-center gap-2.5 rounded-lg px-2 py-2 opacity-40 cursor-not-allowed select-none">
                <Lock className="h-4 w-4 shrink-0 text-white/50" />
                <span className="text-xs text-white/50">Admin access only</span>
              </div>
            </section>
          )
        )}
      </nav>

      {/* ── Bottom nav + user ────────────────────────────────────── */}
      <div className="border-t border-white/10 px-2 py-2">
        {/* Settings — admin only */}
        {isAdmin && (
          <ul className="space-y-0.5 mb-1">
            {BOTTOM_ITEMS.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
            ))}
          </ul>
        )}

        {/* User avatar */}
        <div className={cn('mt-2 flex items-center gap-2.5 rounded-lg px-2 py-2', collapsed && 'justify-center')}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white">
            {initials(user.email ?? 'U')}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="truncate text-xs font-medium text-white">{user.email}</p>
              <p className="truncate text-[10px] text-white/40 capitalize">{tenantRole}</p>
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

// ── NavLink ───────────────────────────────────────────────────────────────────

function NavLink({ item, pathname, collapsed }: { item: NavItem; pathname: string; collapsed: boolean }) {
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

// ── BuildingIcon ──────────────────────────────────────────────────────────────

function BuildingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path d="M3 11L12 3l9 8" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="5" y="11" width="14" height="10" rx="1" fill="white" opacity="0.15"/>
      <rect x="7" y="13" width="3" height="3" rx="0.4" fill="white" opacity="0.9"/>
      <rect x="14" y="13" width="3" height="3" rx="0.4" fill="white" opacity="0.9"/>
      <rect x="9.5" y="16.5" width="5" height="4.5" rx="0.4" fill="white" opacity="0.95"/>
    </svg>
  )
}
