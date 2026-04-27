import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { KeysClient } from '@/components/security/keys-client'

export const metadata: Metadata = { title: 'Key Management' }

export default async function KeysPage() {
  const supabase = createAdminClient()

  const [{ data: keys }, { data: rooms }] = await Promise.all([
    supabase
      .from('room_keys')
      .select(`
        *,
        rooms(room_number, block),
        bookings(booking_ref),
        occupants(first_name, last_name)
      `)
      .order('created_at', { ascending: false }),
    supabase
      .from('rooms')
      .select('id, room_number, block')
      .eq('status', 'available')
      .order('room_number'),
  ])

  const issued  = (keys ?? []).filter((k) => k.status === 'issued').length
  const lost    = (keys ?? []).filter((k) => k.status === 'lost').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Key Management</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            {issued} issued · {lost} lost · {(keys ?? []).filter((k) => k.status === 'available').length} available
          </p>
        </div>
        <Link href="/security" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
          ← Security
        </Link>
      </div>
      <KeysClient initialKeys={(keys ?? []) as any} rooms={(rooms ?? []) as any} />
    </div>
  )
}
