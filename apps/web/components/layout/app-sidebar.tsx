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

type IconAnim = 'bounce' | 'shake' | 'spin' | 'pulse' | 'swing' | 'ring' | 'slide' | 'flip' | 'tilt' | 'pop'

// Explicit map so class names aren't purged by Tailwind/PostCSS
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

interface NavItem {
  label: string
  href:  string
  icon:  React.ElementType
  anim:  IconAnim
  badge?: string
}

/** Day-to-day operations — visible to ALL authenticated roles (staff + admin) */
const OPS_ITEMS: NavItem[] = [
  { label: 'Dashboard',      href: '/dashboard',      icon: LayoutDashboard, anim: 'pulse'  },
  { label: 'Occupants',      href: '/occupants',      icon: Users,           anim: 'bounce' },
  { label: 'Rooms',          href: '/rooms',           icon: BedDouble,       anim: 'tilt'   },
  { label: 'Bookings',       href: '/bookings',        icon: CalendarCheck,   anim: 'flip'   },
  { label: 'Housekeeping',   href: '/housekeeping',    icon: Wrench,          anim: 'swing'  },
  { label: 'Maintenance',    href: '/maintenance',     icon: HardHat,         anim: 'bounce' },
  { label: 'Kiosk',          href: '/kiosk',           icon: Monitor,         anim: 'pulse'  },
  { label: 'Lost & Found',   href: '/lost-found',      icon: Search,          anim: 'slide'  },
  { label: 'Communications', href: '/communications',  icon: MessageSquare,   anim: 'shake'  },
  { label: 'Security',       href: '/security',        icon: Shield,          anim: 'pop'    },
]

/** Sensitive management — visible to owner / manager / admin ONLY */
const ADMIN_ITEMS: NavItem[] = [
  { label: 'Portfolio',      href: '/portfolio',           icon: Building2,    anim: 'tilt'   },
  { label: 'Invoices',       href: '/invoices',            icon: FileText,     anim: 'slide'  },
  { label: 'Payments',       href: '/payments',            icon: DollarSign,   anim: 'bounce' },
  { label: 'Accounting',     href: '/accounting',          icon: BookOpen,     anim: 'flip'   },
  { label: 'Expenses',       href: '/accounting/expenses', icon: TrendingDown, anim: 'slide'  },
  { label: 'Staff',          href: '/staff',               icon: UserCog,      anim: 'spin'   },
  { label: 'Assets',         href: '/assets',              icon: Package,      anim: 'tilt'   },
  { label: 'Waiting List',   href: '/waiting-list',        icon: ListOrdered,  anim: 'slide'  },
  { label: 'Reports',        href: '/reports',             icon: BarChart3,    anim: 'pulse'  },
  { label: 'Intelligence',   href: '/intelligence',        icon: Sparkles,     anim: 'pop'    },
  { label: 'AI Assistant',   href: '/ai',                  icon: Bot,          anim: 'ring'   },
  { label: 'Activity log',   href: '/activity',            icon: ClipboardList,anim: 'shake'  },
]

const BOTTOM_ITEMS: NavItem[] = [
  { label: 'Settings', href: '/settings', icon: Settings, anim: 'spin' },
]

// ── Component ────────────────────────────────────────────────────────────────

interface AppSidebarProps {
  user:       User
  tenantRole: string
}

export function AppSidebar({ user, tenantRole }: AppSidebarProps) {
  const pathname   = usePathname()
  const { tenantName, tenantLogo } = useTenant()
  const [collapsed, setCollapsed] = useState(false)

  const isAdmin = isAdminRole(tenantRole)

  return (
    <aside
      className={cn(
        'sidebar-transition flex h-screen flex-col',
        'bg-[#000000] border-r border-[rgba(214,235,253,0.19)]',
        collapsed ? 'w-sidebar-collapsed' : 'w-sidebar'
      )}
    >
      {/* ── Logo / hostel name ──────────────────────────────────── */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-[rgba(214,235,253,0.10)]">
        {!collapsed && (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[rgba(255,255,255,0.08)] ring-1 ring-[rgba(214,235,253,0.19)] overflow-hidden">
              {tenantLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tenantLogo} alt="" className="h-8 w-8 object-cover" />
              ) : tenantName ? (
                <span className="font-display text-sm font-bold text-[#f0f0f0]">{initials(tenantName)}</span>
              ) : (
                <BuildingIcon />
              )}
            </div>
            <span className="truncate text-sm font-semibold text-[#f0f0f0] tracking-[-0.01em]">
              {tenantName ?? 'GH Hostels'}
            </span>
          </div>
        )}
        {collapsed && (
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(255,255,255,0.08)] ring-1 ring-[rgba(214,235,253,0.19)] overflow-hidden">
            {tenantLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tenantLogo} alt="" className="h-8 w-8 object-cover" />
            ) : tenantName ? (
              <span className="font-display text-sm font-bold text-[#f0f0f0]">{initials(tenantName)}</span>
            ) : (
              <BuildingIcon />
            )}
          </div>
        )}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="ml-auto rounded-md p-1 text-[#464a4d] hover:text-[#a1a4a5] hover:bg-[rgba(255,255,255,0.06)] transition-all duration-200"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Main nav ─────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-5">

        {/* Operations — all roles */}
        <section>
          {!collapsed && (
            <p className="mb-2 px-2 text-[10px] font-medium uppercase tracking-[0.1em] text-[#464a4d]">
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
              <p className="mb-2 px-2 text-[10px] font-medium uppercase tracking-[0.1em] text-[#464a4d]">
                Admin
              </p>
            )}
            {collapsed && (
              <div className="my-2 mx-2 border-t border-[rgba(214,235,253,0.12)]" />
            )}
            <ul className="space-y-0.5">
              {ADMIN_ITEMS.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
              ))}
            </ul>
          </section>
        ) : (
          !collapsed && (
            <section>
              <p className="mb-2 px-2 text-[10px] font-medium uppercase tracking-[0.1em] text-[#464a4d]">
                Admin
              </p>
              <div className="flex items-center gap-2.5 rounded-md px-2 py-2 opacity-40 cursor-not-allowed select-none">
                <Lock className="h-4 w-4 shrink-0 text-[#464a4d]" />
                <span className="text-xs text-[#464a4d]">Admin access only</span>
              </div>
            </section>
          )
        )}
      </nav>

      {/* ── Bottom nav + user ────────────────────────────────────── */}
      <div className="border-t border-[rgba(214,235,253,0.12)] px-2 py-2">
        {/* Settings — admin only */}
        {isAdmin && (
          <ul className="space-y-0.5 mb-1">
            {BOTTOM_ITEMS.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
            ))}
          </ul>
        )}

        {/* User avatar */}
        <div className={cn(
          'mt-2 flex items-center gap-2.5 rounded-lg px-2 py-2',
          collapsed && 'justify-center'
        )}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(255,255,255,0.08)] ring-1 ring-[rgba(214,235,253,0.15)] text-xs font-medium text-[#a1a4a5]">
            {initials(user.email ?? 'U')}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="truncate text-xs font-medium text-[#f0f0f0]">{user.email}</p>
              <p className="truncate text-[10px] text-[#464a4d] capitalize">{tenantRole}</p>
            </div>
          )}
        </div>

        {/* Expand toggle — show when collapsed */}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="mt-1 flex w-full items-center justify-center rounded-md p-1 text-[#464a4d] hover:text-[#a1a4a5] hover:bg-[rgba(255,255,255,0.06)] transition-all duration-200"
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
          ANIM_CLASS[item.anim],
          'flex items-center gap-3 rounded-md px-2 py-[7px] text-[13px] transition-all duration-200',
          collapsed && 'justify-center px-2',
          isActive
            ? 'bg-[rgba(255,255,255,0.08)] text-[#f0f0f0] font-medium shadow-[inset_0_0_0_1px_rgba(214,235,253,0.12)]'
            : 'text-[#a1a4a5] hover:text-[#f0f0f0] hover:bg-[rgba(255,255,255,0.05)]'
        )}
        title={collapsed ? item.label : undefined}
      >
        <span className="sb-icon relative flex shrink-0 items-center justify-center" style={{ perspective: '600px' }}>
          <Icon className={cn('h-[18px] w-[18px]', !isActive && 'opacity-70')} />
        </span>
        {!collapsed && (
          <span className="truncate tracking-[0.01em]">{item.label}</span>
        )}
        {!collapsed && item.badge && (
          <span className="ml-auto rounded-full bg-[rgba(255,128,31,0.15)] px-1.5 py-0.5 text-[10px] font-medium text-[#ff801f]">
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
      <path d="M3 11L12 3l9 8" stroke="#f0f0f0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="5" y="11" width="14" height="10" rx="1" fill="#f0f0f0" opacity="0.15"/>
      <rect x="7" y="13" width="3" height="3" rx="0.4" fill="#f0f0f0" opacity="0.9"/>
      <rect x="14" y="13" width="3" height="3" rx="0.4" fill="#f0f0f0" opacity="0.9"/>
      <rect x="9.5" y="16.5" width="5" height="4.5" rx="0.4" fill="#f0f0f0" opacity="0.95"/>
    </svg>
  )
}
