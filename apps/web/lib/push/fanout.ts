/**
 * Push fanout to a target user or to all owners of a tenant.
 *
 * Loads native device tokens from device_push_tokens, sends via FCM HTTP v1,
 * and prunes invalid tokens. Web-push (push_subscriptions) is handled
 * separately by lib/push.ts — this module is native-only.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { sendToTokens, type NativePushPayload } from './native'

export interface FanoutResult {
  user_id:        string
  tokens_found:   number
  sent:           number
  failed:         number
  invalid_pruned: number
}

export async function fanoutToUser(userId: string, payload: NativePushPayload): Promise<FanoutResult> {
  const admin = createAdminClient() as any
  const { data: rows, error } = await admin
    .from('device_push_tokens')
    .select('token')
    .eq('user_id', userId)

  if (error) throw new Error(`device_push_tokens select: ${error.message}`)

  const tokens = ((rows ?? []) as { token: string }[]).map(r => r.token)
  if (tokens.length === 0) {
    return { user_id: userId, tokens_found: 0, sent: 0, failed: 0, invalid_pruned: 0 }
  }

  const res = await sendToTokens(tokens, payload)

  if (res.invalidTokens.length > 0) {
    await admin
      .from('device_push_tokens')
      .delete()
      .in('token', res.invalidTokens)
  }

  return {
    user_id:        userId,
    tokens_found:   tokens.length,
    sent:           res.sent,
    failed:         res.failed,
    invalid_pruned: res.invalidTokens.length,
  }
}

/** Send to every tenant_members.role = 'owner' user for a tenant. */
export async function fanoutToTenantOwners(tenantId: string, payload: NativePushPayload): Promise<FanoutResult[]> {
  const admin = createAdminClient() as any
  const { data: members } = await admin
    .from('tenant_members')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .eq('role', 'owner')

  const userIds = ((members ?? []) as { user_id: string }[]).map(m => m.user_id)
  if (userIds.length === 0) return []
  return Promise.all(userIds.map(id => fanoutToUser(id, payload)))
}
