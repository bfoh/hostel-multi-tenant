import Link from 'next/link'
import { AccountingSubNav } from '@/components/accounting/sub-nav'

export default function AccountingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-text-tertiary">
          <Link href="/" className="hover:text-text-primary transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href="/accounting" className="hover:text-text-primary transition-colors">Accounting</Link>
        </div>
        <AccountingSubNav />
      </div>
      {children}
    </div>
  )
}
