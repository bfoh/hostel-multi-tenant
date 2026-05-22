import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { listInbox, ensureBroadcastConversation } from '@/lib/messages/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolvePeerDisplayNames } from '@/lib/messages/peers'
import { InboxList } from '@/components/messages/inbox-list'
import { NewMessageButton } from '@/components/messages/new-message-button'
import { MessageCircle } from 'lucide-react'

export const metadata: Metadata = { title: 'Messages' }
export const dynamic = 'force-dynamic'

export default async function OccupantInboxPage() {
  const h        = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) redirect('/login')

  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient() as any

  // Ensure the occupant is a participant of the hostel-wide broadcast
  // conversation, so announcements show up in their inbox even before
  // Phase 4's auto-add trigger is in place. Idempotent.
  const bc = await ensureBroadcastConversation({ tenantId, createdBy: user.id })
  if ('conversation' in bc) {
    await admin.from('conversation_participants').upsert(
      {
        conversation_id:  bc.conversation.id,
        tenant_id:        tenantId,
        user_id:          user.id,
        participant_kind: 'occupant',
      },
      { onConflict: 'conversation_id,user_id', ignoreDuplicates: true },
    )
  }

  const items = await listInbox({ tenantId, userId: user.id })

  const peerIds = items.map(i => i.peer_user_id).filter((x): x is string => !!x)
  const peerNames = await resolvePeerDisplayNames(tenantId, peerIds)

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100">
            <MessageCircle className="h-5 w-5 text-slate-500" strokeWidth={2.1} />
          </span>
          <div>
            <h1 className="text-[18px] font-bold tracking-tight text-slate-900">Messages</h1>
            <p className="text-[12px] text-slate-500">Chat with staff and residents</p>
          </div>
        </div>
        <NewMessageButton basePath="/occupant-portal/messages" label="Message" />
      </header>

      <InboxList
        currentUserId={user.id}
        initial={items}
        peerNames={peerNames}
      />
    </div>
  )
}
