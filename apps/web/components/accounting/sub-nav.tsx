'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  BookOpen,
  Scale,
  BarChart3,
  Landmark,
  Waves,
  DollarSign,
  GitMerge,
  Receipt,
} from 'lucide-react'

const TABS = [
  { href: '/accounting',                label: 'Overview',     icon: LayoutDashboard },
  { href: '/accounting/journal',        label: 'Journal',      icon: BookOpen },
  { href: '/accounting/trial-balance',  label: 'Trial Balance',icon: Scale },
  { href: '/accounting/pnl',            label: 'P&L',          icon: BarChart3 },
  { href: '/accounting/balance-sheet',  label: 'Balance Sheet',icon: Landmark },
  { href: '/accounting/cash-flow',      label: 'Cash Flow',    icon: Waves },
  { href: '/accounting/chart',          label: 'Chart',        icon: DollarSign },
  { href: '/accounting/expenses',       label: 'Expenses',     icon: Receipt },
  { href: '/accounting/reconcile',      label: 'Reconcile',    icon: GitMerge },
] as const

export function AccountingSubNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Accounting sections"
      className="-mx-1 flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1"
    >
      {TABS.map((tab) => {
        const Icon = tab.icon
        const active = tab.href === '/accounting'
          ? pathname === '/accounting'
          : pathname === tab.href || pathname.startsWith(tab.href + '/')

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              active
                ? 'bg-brand text-white shadow-sm'
                : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
