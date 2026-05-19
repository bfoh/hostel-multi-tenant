import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { listInbox } from '@/lib/messages/server'
import { InboxList } from '@/components/messages/inbox-list'
import { NewMessageButton } from '@/components/messages/new-message-button'
import { resolvePeerDisplayNames } from '@/lib/messages/peers'

export const metadata: Metadata = { title: 'Messages' }
export const dynamic = 'force-dynamic'

export default async function MessagesInboxPage() {
  const h        = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) redirect('/login')

  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) redirect('/login')

  const items = await listInbox({ tenantId, userId: user.id })

  // Resolve display names for peer user ids on direct DMs
  const peerIds = items.map(i => i.peer_user_id).filter((x): x is string => !!x)
  const peerNames = await resolvePeerDisplayNames(tenantId, peerIds)

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Messages</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            Direct conversations, groups, and hostel announcements.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/messages/broadcast"
            className="rounded-md border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-sunken transition-colors"
          >
            Broadcast
          </a>
          <a
            href="/messages/group/new"
            className="rounded-md border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-sunken transition-colors"
          >
            New group
          </a>
          <NewMessageButton basePath="/messages" />
        </div>
      </header>

      <InboxList
        currentUserId={user.id}
        initial={items}
        peerNames={peerNames}
      />
    </div>
  )
}
