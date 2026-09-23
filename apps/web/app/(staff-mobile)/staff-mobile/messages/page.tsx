import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { listInbox } from '@/lib/messages/server'
import { InboxList } from '@/components/messages/inbox-list'
import { NewMessageButton } from '@/components/messages/new-message-button'
import { resolvePeerDisplayNames } from '@/lib/messages/peers'

export const metadata: Metadata = { title: 'Messages · Staff' }
export const dynamic = 'force-dynamic'

export default async function StaffMobileMessagesPage() {
  const h        = await headers()
  const tenantId = h.get('x-tenant-id')
  const nounSingular = h.get('x-tenant-business-type') === 'hotel' ? 'hotel' : 'hostel'
  if (!tenantId) redirect('/login')

  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) redirect('/login')

  const items = await listInbox({ tenantId, userId: user.id })

  const peerIds   = items.map((i) => i.peer_user_id).filter((x): x is string => !!x)
  const peerNames = await resolvePeerDisplayNames(tenantId, peerIds)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Messages</h1>
          <p className="mt-0.5 text-xs text-slate-500">Guests, colleagues, and {nounSingular} announcements.</p>
        </div>
        <NewMessageButton basePath="/messages" />
      </div>

      <InboxList currentUserId={user.id} initial={items} peerNames={peerNames} />
    </div>
  )
}
