import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createTenantAdminClient } from '@/lib/supabase/tenant-admin'
import { resolvePeerDisplayNames } from '@/lib/messages/peers'
import { ThreadView } from '@/components/messages/thread-view'
import { ConversationMenu } from '@/components/messages/conversation-menu'

export const metadata: Metadata = { title: 'Conversation' }
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function OccupantThreadPage({ params }: PageProps) {
  const { id } = await params

  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) redirect('/login')

  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) redirect('/login')

  const admin = createTenantAdminClient(tenantId) as any

  const { data: conv } = await admin
    .from('conversations')
    .select('id, tenant_id, type, title, created_by, broadcast_filter')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!conv) notFound()

  const { data: me } = await admin
    .from('conversation_participants')
    .select('id, role, muted_until, archived_at, pinned_at')
    .eq('conversation_id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!me) notFound()

  const { data: parts } = await admin
    .from('conversation_participants')
    .select('user_id, role, participant_kind')
    .eq('conversation_id', id)
  const partRows = (parts ?? []) as any[]
  const peerNames = await resolvePeerDisplayNames(tenantId, partRows.map(p => p.user_id))

  const { data: msgs } = await admin
    .from('messages')
    .select(`
      id, conversation_id, sender_id, kind, body, reply_to_id, attachments, metadata,
      edited_at, deleted_at, created_at,
      reactions:message_reactions(id, emoji, user_id)
    `)
    .eq('conversation_id', id)
    .order('created_at', { ascending: false })
    .limit(50)

  const initialMessages = ((msgs ?? []) as any[]).reverse()

  const peerUserId = conv.type === 'direct'
    ? partRows.find(p => p.user_id !== user.id)?.user_id ?? null
    : null

  const headerTitle = conv.title
    ?? (conv.type === 'broadcast' ? 'Announcements'
        : peerUserId ? peerNames[peerUserId]?.display ?? 'Direct message'
        : 'Conversation')
  const headerSub = conv.type === 'direct' && peerUserId
    ? peerNames[peerUserId]?.subtitle ?? null
    : conv.type === 'broadcast' ? 'Hostel-wide announcements'
    : conv.type === 'group' ? `${partRows.length} members`
    : null

  // Occupants cannot post to broadcast
  const canPost = conv.type !== 'broadcast'

  return (
    <div className="mx-auto flex h-[calc(100dvh-6rem)] max-w-3xl flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3">
        <Link href="/occupant-portal/messages" className="rounded p-1.5 text-text-tertiary hover:bg-surface-raised">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text-primary">{headerTitle}</p>
          {headerSub && <p className="truncate text-[11px] text-text-tertiary">{headerSub}</p>}
        </div>
        <ConversationMenu
          conversationId={id}
          state={{
            muted_until: (me as any).muted_until ?? null,
            archived_at: (me as any).archived_at ?? null,
            pinned_at:   (me as any).pinned_at ?? null,
          }}
        />
      </header>

      <ThreadView
        conversationId={id}
        conversationType={conv.type}
        currentUserId={user.id}
        canPost={canPost}
        initialMessages={initialMessages}
        peerNames={peerNames}
      />
    </div>
  )
}
