/**
 * Web Push notification utility.
 *
 * Required env vars (generate with `npx web-push generate-vapid-keys`):
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY  — shared to browser
 *   VAPID_PRIVATE_KEY             — server-only
 *   VAPID_EMAIL                   — e.g. mailto:admin@yoursite.com
 */
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

function getVapid() {
  const publicKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const email      = process.env.VAPID_EMAIL ?? 'mailto:admin@ghh.com'
  return { publicKey, privateKey, email }
}

interface PushPayload {
  title: string
  body:  string
  url?:  string
  tag?:  string
}

/**
 * Send a push notification to all subscriptions for a given tenant.
 * Silently removes expired/invalid subscriptions.
 */
export async function sendPushToTenant(tenantId: string, payload: PushPayload) {
  const { publicKey, privateKey, email } = getVapid()
  if (!publicKey || !privateKey) return  // VAPID not configured — skip

  webpush.setVapidDetails(email, publicKey, privateKey)

  const supabase = createAdminClient()
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth_key')
    .eq('tenant_id', tenantId)

  if (!subs || subs.length === 0) return

  const body = JSON.stringify(payload)
  const expiredIds: string[] = []

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys:     { p256dh: sub.p256dh, auth: sub.auth_key },
          },
          body
        )
      } catch (err: any) {
        // 410 Gone or 404 = subscription expired — clean it up
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          expiredIds.push(sub.id)
        }
      }
    })
  )

  if (expiredIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expiredIds)
  }
}

/**
 * Send a push to one or more specific user_ids. Used for direct addressing
 * (e.g. resident getting a reply). Silently no-ops when VAPID isn't configured
 * or the users have no subscriptions.
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  if (userIds.length === 0) return
  const { publicKey, privateKey, email } = getVapid()
  if (!publicKey || !privateKey) return

  webpush.setVapidDetails(email, publicKey, privateKey)

  const supabase = createAdminClient()
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth_key')
    .in('user_id', userIds)

  if (!subs || subs.length === 0) return

  const body = JSON.stringify(payload)
  const expiredIds: string[] = []

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          body,
        )
      } catch (err: any) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          expiredIds.push(sub.id)
        }
      }
    }),
  )

  if (expiredIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expiredIds)
  }
}
