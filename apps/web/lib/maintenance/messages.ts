/**
 * Maintenance message thread helpers.
 *
 * "Message" = one row in `maintenance_messages` belonging to a maintenance
 * request. Three author kinds: 'occupant', 'staff', 'system'.
 *
 * Auth happens at the route layer; these helpers trust their inputs and run
 * with the service role.
 */

import { createAdminClient } from '@/lib/supabase/admin'

export type AuthorKind = 'occupant' | 'staff' | 'system'

export interface Message {
  id:             string
  request_id:     string
  author_user_id: string | null
  author_kind:    AuthorKind
  body:           string | null
  attachments:    string[]
  created_at:     string
}

const SELECT_COLS = 'id, request_id, author_user_id, author_kind, body, attachments, created_at'

export async function getThread(requestId: string, tenantId: string): Promise<Message[]> {
  const admin = createAdminClient() as any
  const { data, error } = await admin
    .from('maintenance_messages')
    .select(SELECT_COLS)
    .eq('tenant_id', tenantId)
    .eq('request_id', requestId)
    .order('created_at', { ascending: true })
    .limit(500)
  if (error) {
    console.error('[maintenance:getThread]', { tenantId, requestId, error })
    return []
  }
  return (data ?? []) as Message[]
}

interface InsertArgs {
  tenantId:     string
  requestId:    string
  authorUserId: string | null
  authorKind:   AuthorKind
  body:         string | null
  attachments:  string[]
  messageId?:   string
}

export async function insertMessage(args: InsertArgs): Promise<{ id: string; created_at: string } | { error: string }> {
  const admin = createAdminClient() as any
  const { data, error } = await admin
    .from('maintenance_messages')
    .insert({
      ...(args.messageId ? { id: args.messageId } : {}),
      tenant_id:      args.tenantId,
      request_id:     args.requestId,
      author_user_id: args.authorUserId,
      author_kind:    args.authorKind,
      body:           args.body,
      attachments:    args.attachments,
    })
    .select('id, created_at')
    .single()
  if (error) {
    console.error('[maintenance:insertMessage]', error)
    return { error: error.message }
  }
  return { id: data.id, created_at: data.created_at }
}

export async function insertSystemMessage(args: { tenantId: string; requestId: string; body: string }) {
  return insertMessage({
    tenantId:     args.tenantId,
    requestId:    args.requestId,
    authorUserId: null,
    authorKind:   'system',
    body:         args.body,
    attachments:  [],
  })
}

/** Has staff replied to this request previously? Drives "first reply" SMS rule. */
export async function hasPriorStaffMessage(requestId: string, tenantId: string): Promise<boolean> {
  const admin = createAdminClient() as any
  const { count } = await admin
    .from('maintenance_messages')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('request_id', requestId)
    .eq('author_kind', 'staff')
  return (count ?? 0) > 0
}

/** Will the about-to-be-inserted occupant reply be the first since the latest staff message? */
export async function isFirstOccupantReplySinceStaff(requestId: string, tenantId: string): Promise<boolean> {
  const admin = createAdminClient() as any
  const { data: latestStaff } = await admin
    .from('maintenance_messages')
    .select('created_at')
    .eq('tenant_id', tenantId)
    .eq('request_id', requestId)
    .eq('author_kind', 'staff')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!latestStaff) return true

  const { count } = await admin
    .from('maintenance_messages')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('request_id', requestId)
    .eq('author_kind', 'occupant')
    .gt('created_at', latestStaff.created_at)
  return (count ?? 0) === 0
}

/** Roles that can read + reply to maintenance threads. No 'maintenance' role exists; housekeeper closest. */
export const MAINTENANCE_ROLES = ['owner', 'manager', 'housekeeper'] as const

export async function listMaintenanceStaffUserIds(tenantId: string): Promise<string[]> {
  const admin = createAdminClient() as any
  const { data } = await admin
    .from('tenant_members')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .in('role', [...MAINTENANCE_ROLES])
  return (data ?? []).map((r: { user_id: string }) => r.user_id)
}
