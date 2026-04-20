import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Check platform_admins table via service role (RLS blocks normal reads)
  const admin = createAdminClient()
  const { data: pa } = await admin
    .from('platform_admins')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!pa) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      {/* Admin top bar */}
      <header className="border-b border-white/10 bg-[#1a1a1a] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="rounded bg-red-600 px-2 py-0.5 text-xs font-bold uppercase tracking-wide">
            Super Admin
          </span>
          <span className="text-sm font-semibold text-white/80">GH Hostels Platform</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-white/50">
          <span>{user.email}</span>
          <a href="/dashboard" className="text-white/70 hover:text-white transition-colors">
            → Back to app
          </a>
        </div>
      </header>

      {/* Admin nav */}
      <nav className="border-b border-white/10 bg-[#141414] px-6">
        <div className="flex gap-6">
          {[
            { href: '/admin',               label: 'Overview' },
            { href: '/admin/tenants',       label: 'Tenants' },
            { href: '/admin/subscriptions', label: 'Subscriptions' },
            { href: '/admin/payouts',       label: 'Payouts' },
          ].map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="py-3 text-sm font-medium text-white/60 hover:text-white border-b-2 border-transparent hover:border-white/30 transition-colors"
            >
              {label}
            </a>
          ))}
        </div>
      </nav>

      <main className="p-6">{children}</main>
    </div>
  )
}
