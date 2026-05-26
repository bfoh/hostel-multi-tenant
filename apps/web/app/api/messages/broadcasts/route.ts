/**
 * POST /api/messages/broadcasts  { body, filter? }
 *
 * Posts to the tenant's hostel-wide broadcast conversation. When `filter`
 * is provided we materialise a *slice* — a separate broadcast conversation
 * whose `broadcast_filter` is the supplied object — and add only matching
 * occupants. Examples:
 *
 *   { block: "A" }                 → only block-A occupants
 *   { occupant_ids: [uuid, uuid] } → explicit list
 *
 * Staff-only. The DB trigger `messaging_gate_broadcast_writes` also
 * enforces this at insert time.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createTenantAdminClientFromHeaders } from '@/lib/supabase/tenant-admin'
import {
  ensureBroadcastConversation,
  postMessage,
  resolveParticipantKind,
} from '@/lib/messages/server'

const filterSchema = z.object({
  block:         z.string().min(1).max(40).optional(),
  occupant_ids:  z.array(z.string().uuid()).max(500).optional(),
  title:         z.string().min(1).max(120).optional(),
}).optional()

const schema = z.object({
  body:   z.string().min(1).max(4000),
  filter: filterSchema,
})

export async function POST(req: NextRequest) {
  const h = await headers()
  const tenantId = h.get('x-tenant-id')
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 401 })

  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const kind = await resolveParticipantKind(tenantId, user.id)
  if (kind !== 'staff') {
    return NextResponse.json({ error: 'Only staff can broadcast' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const admin = await createTenantAdminClientFromHeaders() as any

  // Resolve conversation: default hostel-wide, or a filtered slice.
  let conversationId: string

  if (parsed.data.filter && (parsed.data.filter.block || parsed.data.filter.occupant_ids?.length)) {
    // Try to reuse an existing slice with an identical filter JSON.
    const filterJson = parsed.data.filter
    const { data: existing } = await admin
      .from('conversations')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('type', 'broadcast')
      .contains('broadcast_filter', filterJson)
      .maybeSingle()

    if (existing) {
      conversationId = existing.id
    } else {
      const { data: created, error } = await admin
        .from('conversations')
        .insert({
          tenant_id:        tenantId,
          type:             'broadcast',
          title:            parsed.data.filter.title ?? sliceTitle(parsed.data.filter),
          created_by:       user.id,
          broadcast_filter: filterJson,
        })
        .select('id')
        .single()
      if (error || !created) return NextResponse.json({ error: 'Could not create slice' }, { status: 500 })
      conversationId = created.id
    }

    // Resolve target occupants and seed participants
    const occIds = await resolveTargetOccupantIds(tenantId, parsed.data.filter)
    if (occIds.length > 0) {
      await admin.from('conversation_participants').upsert(
        occIds.map((uid) => ({
          conversation_id:  conversationId,
          tenant_id:        tenantId,
          user_id:          uid,
          participant_kind: 'occupant' as const,
        })),
        { onConflict: 'conversation_id,user_id', ignoreDuplicates: true },
      )
    }
  } else {
    const bc = await ensureBroadcastConversation({ tenantId, createdBy: user.id })
    if ('error' in bc) return NextResponse.json({ error: bc.error }, { status: 500 })
    conversationId = bc.conversation.id

    // Seed all occupants (idempotent upsert). Phase 4 trigger keeps new ones in sync.
    await seedAllOccupants(tenantId, conversationId)
  }

  // Always ensure sender is a participant so they see their own post in their inbox
  await admin.from('conversation_participants').upsert(
    {
      conversation_id:  conversationId,
      tenant_id:        tenantId,
      user_id:          user.id,
      participant_kind: 'staff' as const,
    },
    { onConflict: 'conversation_id,user_id', ignoreDuplicates: true },
  )

  const result = await postMessage({
    tenantId,
    conversationId,
    senderId: user.id,
    body:     parsed.data.body,
    kind:     'text',
  })
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({
    conversation_id: conversationId,
    message:         result.message,
  }, { status: 201 })
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

function sliceTitle(filter: { block?: string; occupant_ids?: string[] }): string {
  if (filter.block) return `Block ${filter.block} announcements`
  if (filter.occupant_ids?.length) return `Custom group (${filter.occupant_ids.length})`
  return 'Announcement'
}

async function resolveTargetOccupantIds(
  tenantId: string,
  filter:   { block?: string; occupant_ids?: string[] },
): Promise<string[]> {
  const admin = await createTenantAdminClientFromHeaders() as any

  if (filter.occupant_ids?.length) {
    // Validate those are real occupants in this tenant
    const { data } = await admin
      .from('occupants')
      .select('user_id')
      .eq('tenant_id', tenantId)
      .in('id', filter.occupant_ids)
      .not('user_id', 'is', null)
    return ((data ?? []) as any[]).map(r => r.user_id as string)
  }

  if (filter.block) {
    const { data } = await admin
      .from('occupants')
      .select(`user_id, rooms:rooms!inner(block)`)
      .eq('tenant_id', tenantId)
      .eq('rooms.block', filter.block)
      .not('user_id', 'is', null)
    return ((data ?? []) as any[]).map(r => r.user_id as string)
  }

  return []
}

async function seedAllOccupants(tenantId: string, conversationId: string) {
  const admin = await createTenantAdminClientFromHeaders() as any
  const { data } = await admin
    .from('occupants')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .not('user_id', 'is', null)

  const rows = ((data ?? []) as any[]).map((r) => ({
    conversation_id:  conversationId,
    tenant_id:        tenantId,
    user_id:          r.user_id,
    participant_kind: 'occupant' as const,
  }))
  if (rows.length === 0) return

  await admin.from('conversation_participants').upsert(
    rows,
    { onConflict: 'conversation_id,user_id', ignoreDuplicates: true },
  )
}
