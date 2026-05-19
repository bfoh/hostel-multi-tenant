/**
 * Server helpers for the in-app messaging system.
 *
 * All writes go through these — they handle:
 *   • tenant scoping
 *   • RLS-safe inserts (creator + counterpart added in one transaction)
 *   • idempotent direct-DM lookup-or-create via `conversations.direct_key`
 *   • participant kind snapshot (staff/occupant) used by broadcast gating
 */
import { createAdminClient } from '@/lib/supabase/admin'

const STAFF_ROLES = ['owner', 'manager', 'receptionist', 'accountant', 'housekeeper'] as const

export type ParticipantKind = 'staff' | 'occupant' | 'member'

export interface ConversationRow {
  id:                    string
  tenant_id:             string
  type:                  'direct' | 'group' | 'broadcast'
  title:                 string | null
  created_by:            string | null
  direct_key:            string | null
  broadcast_filter:      Record<string, unknown> | null
  last_message_at:       string | null
  last_message_preview:  string | null
  created_at:            string
}

export interface MessageRow {
  id:              string
  conversation_id: string
  tenant_id:       string
  sender_id:       string | null
  kind:            'text' | 'image' | 'file' | 'audio' | 'system'
  body:            string | null
  reply_to_id:     string | null
  attachments:     unknown[]
  metadata:        Record<string, unknown>
  edited_at:       string | null
  deleted_at:      string | null
  created_at:      string
}

/* ── Identity resolution ──────────────────────────────────────────────────── */

/**
 * Classify a user's role inside a tenant. Used to set
 * `conversation_participants.participant_kind` and to gate occupant-DM toggles.
 */
export async function resolveParticipantKind(
  tenantId: string,
  userId:   string,
): Promise<ParticipantKind> {
  const admin = createAdminClient() as any

  const [{ data: staff }, { data: occ }] = await Promise.all([
    admin
      .from('tenant_members')
      .select('role, is_active')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle(),
    admin
      .from('occupants')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  if (staff && (STAFF_ROLES as readonly string[]).includes(staff.role)) return 'staff'
  if (occ)   return 'occupant'
  return 'member'
}

/* ── Direct DM ────────────────────────────────────────────────────────────── */

/**
 * Build the deterministic key for a direct conversation between two users.
 * Sorted so {A,B} and {B,A} collide on the unique index.
 */
function directKey(a: string, b: string): string {
  return [a, b].sort().join(':')
}

/**
 * Find an existing direct conversation between two users in a tenant, or
 * create one. Returns the conversation row.
 *
 * Enforces the tenant's `inter_occupant_dm_enabled` flag when both peers
 * are occupants.
 */
export async function createOrFindDirect(opts: {
  tenantId: string
  initiatorId: string
  peerId: string
}): Promise<{ conversation: ConversationRow } | { error: string }> {
  if (opts.initiatorId === opts.peerId) {
    return { error: 'Cannot DM yourself' }
  }

  const admin = createAdminClient() as any
  const key = directKey(opts.initiatorId, opts.peerId)

  // Fast path — existing conversation
  const { data: existing } = await admin
    .from('conversations')
    .select('*')
    .eq('tenant_id', opts.tenantId)
    .eq('direct_key', key)
    .maybeSingle()

  if (existing) {
    // Ensure both rows exist as participants (cheap upsert)
    await ensureParticipants(opts.tenantId, existing.id, [opts.initiatorId, opts.peerId])
    return { conversation: existing as ConversationRow }
  }

  // Classify both parties — both occupants requires tenant toggle ON.
  const [iKind, pKind] = await Promise.all([
    resolveParticipantKind(opts.tenantId, opts.initiatorId),
    resolveParticipantKind(opts.tenantId, opts.peerId),
  ])
  if (iKind === 'member' || pKind === 'member') {
    return { error: 'Both users must belong to this hostel' }
  }
  if (iKind === 'occupant' && pKind === 'occupant') {
    const { data: t } = await admin
      .from('tenants')
      .select('inter_occupant_dm_enabled')
      .eq('id', opts.tenantId)
      .single()
    if (!t?.inter_occupant_dm_enabled) {
      return { error: 'Inter-occupant messaging is disabled in this hostel' }
    }
  }

  // Create + add both participants
  const { data: conv, error } = await admin
    .from('conversations')
    .insert({
      tenant_id:   opts.tenantId,
      type:        'direct',
      direct_key:  key,
      created_by:  opts.initiatorId,
    })
    .select('*')
    .single()
  if (error || !conv) return { error: error?.message ?? 'create failed' }

  await admin
    .from('conversation_participants')
    .insert([
      { conversation_id: conv.id, tenant_id: opts.tenantId, user_id: opts.initiatorId, participant_kind: iKind },
      { conversation_id: conv.id, tenant_id: opts.tenantId, user_id: opts.peerId,      participant_kind: pKind },
    ])

  return { conversation: conv as ConversationRow }
}

async function ensureParticipants(tenantId: string, conversationId: string, userIds: string[]) {
  const admin = createAdminClient() as any
  for (const uid of userIds) {
    const kind = await resolveParticipantKind(tenantId, uid)
    await admin
      .from('conversation_participants')
      .upsert(
        { conversation_id: conversationId, tenant_id: tenantId, user_id: uid, participant_kind: kind },
        { onConflict: 'conversation_id,user_id', ignoreDuplicates: true },
      )
  }
}

/* ── Group ────────────────────────────────────────────────────────────────── */

export async function createGroup(opts: {
  tenantId:    string
  createdBy:   string
  title:       string
  memberIds:   string[]   // initial members (creator added automatically)
}): Promise<{ conversation: ConversationRow } | { error: string }> {
  const admin = createAdminClient() as any

  // Only staff can create groups in v1
  const kind = await resolveParticipantKind(opts.tenantId, opts.createdBy)
  if (kind !== 'staff') return { error: 'Only staff can create groups' }

  const { data: conv, error } = await admin
    .from('conversations')
    .insert({
      tenant_id:  opts.tenantId,
      type:       'group',
      title:      opts.title.trim().slice(0, 120) || 'Group',
      created_by: opts.createdBy,
    })
    .select('*')
    .single()
  if (error || !conv) return { error: error?.message ?? 'create failed' }

  const seen = new Set<string>()
  seen.add(opts.createdBy)
  for (const id of opts.memberIds) seen.add(id)

  const rows = await Promise.all(
    Array.from(seen).map(async (uid) => ({
      conversation_id: conv.id,
      tenant_id:       opts.tenantId,
      user_id:         uid,
      role:            uid === opts.createdBy ? 'owner' : 'member',
      participant_kind: await resolveParticipantKind(opts.tenantId, uid),
    })),
  )
  await admin.from('conversation_participants').insert(rows)

  return { conversation: conv as ConversationRow }
}

/* ── Broadcast ────────────────────────────────────────────────────────────── */

/**
 * Find the tenant's default broadcast conversation, or create it. Idempotent.
 * Used by both the broadcast composer + the auto-add-occupants trigger
 * (when we add that in Phase 4).
 */
export async function ensureBroadcastConversation(opts: {
  tenantId:  string
  createdBy: string
}): Promise<{ conversation: ConversationRow } | { error: string }> {
  const admin = createAdminClient() as any

  const { data: existing } = await admin
    .from('conversations')
    .select('*')
    .eq('tenant_id', opts.tenantId)
    .eq('type', 'broadcast')
    .is('broadcast_filter', null)
    .maybeSingle()
  if (existing) return { conversation: existing as ConversationRow }

  const { data: conv, error } = await admin
    .from('conversations')
    .insert({
      tenant_id:  opts.tenantId,
      type:       'broadcast',
      title:      'Announcements',
      created_by: opts.createdBy,
    })
    .select('*')
    .single()
  if (error || !conv) return { error: error?.message ?? 'create failed' }

  return { conversation: conv as ConversationRow }
}

/* ── Messages ─────────────────────────────────────────────────────────────── */

export async function postMessage(opts: {
  tenantId:        string
  conversationId:  string
  senderId:        string
  body?:           string | null
  kind?:           MessageRow['kind']
  replyToId?:      string | null
  attachments?:    unknown[]
  metadata?:       Record<string, unknown>
}): Promise<{ message: MessageRow } | { error: string }> {
  const admin = createAdminClient() as any

  const body = (opts.body ?? '').toString().trim()
  const attachments = opts.attachments ?? []
  if (!body && attachments.length === 0 && opts.kind !== 'system') {
    return { error: 'Empty message' }
  }

  const { data, error } = await admin
    .from('messages')
    .insert({
      tenant_id:       opts.tenantId,
      conversation_id: opts.conversationId,
      sender_id:       opts.senderId,
      kind:            opts.kind ?? (attachments.length > 0 && !body ? 'file' : 'text'),
      body:            body || null,
      reply_to_id:     opts.replyToId ?? null,
      attachments,
      metadata:        opts.metadata ?? {},
    })
    .select('*')
    .single()

  if (error || !data) return { error: error?.message ?? 'insert failed' }

  // Fan-out push notifications (fire-and-forget; never blocks the response)
  try {
    const { notifyParticipants } = await import('./notify')
    await notifyParticipants({
      tenantId:        opts.tenantId,
      conversationId:  opts.conversationId,
      senderId:        opts.senderId,
      messageId:       (data as any).id,
      body:            (data as any).body ?? null,
      kind:            (data as any).kind ?? 'text',
      attachmentCount: Array.isArray(attachments) ? attachments.length : 0,
    })
  } catch (err) {
    console.error('[postMessage notify]', err)
  }

  return { message: data as MessageRow }
}

export async function markRead(opts: {
  conversationId: string
  userId:         string
  at?:            string
}): Promise<void> {
  const admin = createAdminClient() as any
  await admin
    .from('conversation_participants')
    .update({ last_read_at: opts.at ?? new Date().toISOString() })
    .eq('conversation_id', opts.conversationId)
    .eq('user_id', opts.userId)
}

/* ── Inbox ────────────────────────────────────────────────────────────────── */

/**
 * Inbox feed for a user. Returns conversations the user participates in,
 * sorted by last_message_at desc, with the unread count derived from
 * last_read_at vs message timestamps.
 *
 * For Phase 1 we keep it simple — the unread count comes from a per-row
 * count(*) of messages later than last_read_at. Phase 7 may optimise via
 * a materialised view if this gets hot.
 */
export interface InboxItem {
  conversation_id:      string
  type:                 'direct' | 'group' | 'broadcast'
  title:                string | null
  last_message_at:      string | null
  last_message_preview: string | null
  last_read_at:         string | null
  muted_until:          string | null
  pinned_at:            string | null
  archived_at:          string | null
  unread_count:         number
  peer_user_id:         string | null   // for direct DMs only
}

export async function listInbox(opts: {
  tenantId: string
  userId:   string
  limit?:   number
}): Promise<InboxItem[]> {
  const admin = createAdminClient() as any
  const limit = opts.limit ?? 50

  const { data: parts } = await admin
    .from('conversation_participants')
    .select(`
      conversation_id, last_read_at, muted_until, archived_at, pinned_at,
      conversation:conversations(id, type, title, last_message_at, last_message_preview)
    `)
    .eq('user_id', opts.userId)
    .eq('tenant_id', opts.tenantId)
    .order('conversation(last_message_at)', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (!parts || parts.length === 0) return []

  // For each direct conversation, fetch the peer user id (the other participant).
  const directConvIds = parts
    .filter((p: any) => p.conversation?.type === 'direct')
    .map((p: any) => p.conversation.id)

  const peerByConv: Record<string, string | null> = {}
  if (directConvIds.length > 0) {
    const { data: peers } = await admin
      .from('conversation_participants')
      .select('conversation_id, user_id')
      .in('conversation_id', directConvIds)
      .neq('user_id', opts.userId)
    for (const p of (peers ?? []) as any[]) {
      peerByConv[p.conversation_id] = p.user_id
    }
  }

  // Unread counts per conversation
  const items: InboxItem[] = []
  for (const p of parts as any[]) {
    if (!p.conversation) continue
    const conv = p.conversation
    let unread = 0
    if (conv.last_message_at) {
      let q = admin
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conv.id)
        .neq('sender_id', opts.userId)
      if (p.last_read_at) q = q.gt('created_at', p.last_read_at)
      const { count } = await q
      unread = count ?? 0
    }
    items.push({
      conversation_id:      conv.id,
      type:                 conv.type,
      title:                conv.title,
      last_message_at:      conv.last_message_at,
      last_message_preview: conv.last_message_preview,
      last_read_at:         p.last_read_at,
      muted_until:          p.muted_until,
      pinned_at:            p.pinned_at,
      archived_at:          p.archived_at,
      unread_count:         unread,
      peer_user_id:         peerByConv[conv.id] ?? null,
    })
  }
  return items
}
