/**
 * Fan-out notifications for a newly-posted message.
 *
 *   - Web push to participants who:
 *       • aren't the sender
 *       • aren't muted right now
 *       • haven't touched the conversation in the last 30 seconds
 *         (best-effort proxy for "they're already viewing it")
 *
 * Fire-and-forget from the request handler. We swallow errors so a flaky
 * push doesn't fail message delivery.
 */
import { createTenantAdminClient } from '@/lib/supabase/tenant-admin'
import { sendPushToUsers } from '@/lib/push'

interface NotifyOpts {
  tenantId:        string
  conversationId:  string
  senderId:        string
  messageId:       string
  body:            string | null
  kind:            string
  attachmentCount: number
}

const RECENT_READ_WINDOW_MS = 30 * 1000

export async function notifyParticipants(opts: NotifyOpts): Promise<void> {
  try {
    const admin = createTenantAdminClient(opts.tenantId) as any
    const now = Date.now()

    // Load conversation context for title + type
    const { data: conv } = await admin
      .from('conversations')
      .select('id, type, title')
      .eq('id', opts.conversationId)
      .single()
    if (!conv) return

    // Sender's display name
    const senderLabel = await resolveSenderLabel(opts.tenantId, opts.senderId)

    // All eligible participants
    const { data: parts } = await admin
      .from('conversation_participants')
      .select('user_id, last_read_at, muted_until')
      .eq('conversation_id', opts.conversationId)
      .neq('user_id', opts.senderId)

    const userIds: string[] = []
    for (const p of (parts ?? []) as any[]) {
      if (p.muted_until && new Date(p.muted_until).getTime() > now) continue
      if (p.last_read_at && now - new Date(p.last_read_at).getTime() < RECENT_READ_WINDOW_MS) continue
      userIds.push(p.user_id)
    }
    if (userIds.length === 0) return

    const title = buildTitle(conv.type, conv.title, senderLabel)
    const body  = buildBody(opts.body, opts.kind, opts.attachmentCount)
    const url   = conversationDeepLink(opts.conversationId)

    await sendPushToUsers(opts.tenantId, userIds, { title, body, url })
  } catch (err) {
    console.error('[messages.notifyParticipants]', err)
  }
}

async function resolveSenderLabel(tenantId: string, userId: string): Promise<string> {
  const admin = createTenantAdminClient(tenantId) as any
  // Try occupant
  const { data: occ } = await admin
    .from('occupants')
    .select('first_name, last_name')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle()
  if (occ) {
    const name = [occ.first_name, occ.last_name].filter(Boolean).join(' ').trim()
    if (name) return name
  }
  // Fall back to staff
  const { data: staff } = await admin
    .from('tenant_members')
    .select(`role, profile:staff_profiles(first_name, last_name)`)
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle()
  if (staff) {
    const profile = Array.isArray(staff.profile) ? staff.profile[0] : staff.profile
    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()
    if (name) return name
    return titleCase(String(staff.role).replace(/_/g, ' '))
  }
  return 'Someone'
}

function buildTitle(type: string, title: string | null, sender: string): string {
  if (type === 'broadcast') return title ?? 'Announcement'
  if (type === 'group')     return title ?? 'New message'
  return sender
}

function buildBody(body: string | null, kind: string, attCount: number): string {
  if (kind === 'image' || (attCount > 0 && !body)) {
    if (kind === 'image') return '📷 Photo'
    if (kind === 'audio') return '🎤 Voice note'
    if (kind === 'file')  return '📎 File'
    return 'Attachment'
  }
  const text = (body ?? '').trim()
  if (text.length === 0) return '·'
  return text.length > 120 ? text.slice(0, 117) + '…' : text
}

function conversationDeepLink(conversationId: string): string {
  // Staff app default. Service worker can route to occupant portal if needed.
  return `/messages/${conversationId}`
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}
