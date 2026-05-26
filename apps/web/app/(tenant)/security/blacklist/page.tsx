import type { Metadata } from 'next'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import Link from 'next/link'
import { BlacklistClient } from '@/components/security/blacklist-client'

export const metadata: Metadata = { title: 'Blacklist' }

export default async function BlacklistPage() {
  const supabase = await createTenantAdminClientFromHeaders()
  const { data: entries } = await supabase
    .from('occupant_blacklist')
    .select('*, occupants(first_name, last_name, phone, email, photo_url)')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Blacklist</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            Flagged and banned occupants — {entries?.filter((e) => e.is_active).length ?? 0} active
          </p>
        </div>
        <Link href="/security" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
          ← Security
        </Link>
      </div>
      <BlacklistClient initialEntries={(entries ?? []) as any} />
    </div>
  )
}
