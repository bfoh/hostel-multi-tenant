import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { BroadcastComposer } from '@/components/messages/broadcast-composer'

export const metadata: Metadata = { title: 'Broadcast announcement' }
export const dynamic = 'force-dynamic'

export default async function BroadcastPage() {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) redirect('/login')

  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient() as any

  // Confirm staff
  const { data: staff } = await admin
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  if (!staff) redirect('/messages')

  // Block list for filter chips — distinct rooms.block values
  const { data: blocks } = await admin
    .from('rooms')
    .select('block')
    .eq('tenant_id', tenantId)
    .not('block', 'is', null)
  const distinctBlocks = Array.from(new Set(((blocks ?? []) as any[]).map(r => r.block as string))).sort()

  // Occupant counts per scope (for preview)
  const { count: totalOccupants } = await admin
    .from('occupants')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .not('user_id', 'is', null)

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/messages" className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary">
        <ArrowLeft className="h-3 w-3" /> Back to messages
      </Link>

      <header>
        <h1 className="text-2xl font-bold text-text-primary">Broadcast announcement</h1>
        <p className="mt-0.5 text-sm text-text-secondary">
          Send a message to every occupant or a filtered slice. Occupants can read but not reply in the broadcast channel.
        </p>
      </header>

      <BroadcastComposer
        blocks={distinctBlocks}
        totalOccupants={totalOccupants ?? 0}
      />
    </div>
  )
}
