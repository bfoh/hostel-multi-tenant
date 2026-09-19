/**
 * Push notification utility — fans out to both web-push (VAPID, browsers)
 * and native push (FCM, the Capacitor mobile app) for every caller. Native
 * fanout was previously wired into only one call site (the owner daily
 * digest, lib/digest/send.ts) — every other notification (maintenance
 * replies, food order status, broadcasts, bank drafts, anomaly alerts,
 * general messaging) only ever reached browsers, which don't reliably
 * deliver push to a closed/backgrounded native iOS app. Centralizing the
 * native call here means every existing caller of sendPushToTenant/
 * sendPushToUsers gets native coverage without being touched individually.
 *
 * Required env vars (generate with `npx web-push generate-vapid-keys`):
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY  — shared to browser
 *   VAPID_PRIVATE_KEY             — server-only
 *   VAPID_EMAIL                   — e.g. mailto:admin@yoursite.com
 *
 * Native push env vars (FCM_PROJECT_ID, FCM_SERVICE_ACCOUNT_JSON) are
 * optional here — native fanout no-ops (logged, not thrown) when they
 * aren't configured, exactly like the VAPID guard below does for web-push.
 */
import webpush from 'web-push'
import { createTenantAdminClient } from '@/lib/supabase/tenant-admin'
import { fanoutToTenant, fanoutToUser } from '@/lib/push/fanout'

/** Never let a native-push failure block or throw past the (already-working) web-push path. */
async function safeNativeFanout(fn: () => Promise<{ sent: number }[]>): Promise<number> {
  try {
    const results = await fn()
    return results.reduce((acc, r) => acc + r.sent, 0)
  } catch (err) {
    console.error('[push] native fanout failed', err)
    return 0
  }
}

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
  /**
   * Deep-link for the native app, when it should differ from `url` (web).
   * E.g. the owner daily digest sends browsers to the full `/dashboard/owner`
   * but the native app — which only ever has the slim `/owner-digest` route
   * per the mobile app's v1 scope — to `/owner-digest`. Defaults to `url`.
   */
  nativePath?: string
  /** Extra native-only data payload (FCM `data` field). */
  nativeData?: Record<string, string>
}

/**
 * Send a push notification to all subscriptions for a given tenant.
 * Silently removes expired/invalid subscriptions.
 */
export async function sendPushToTenant(tenantId: string, payload: PushPayload) {
  const nativeSent = await safeNativeFanout(() =>
    fanoutToTenant(tenantId, {
      title: payload.title,
      body:  payload.body,
      path:  payload.nativePath ?? payload.url,
      data:  payload.nativeData,
    }),
  )

  const { publicKey, privateKey, email } = getVapid()
  if (!publicKey || !privateKey) return  // VAPID not configured — web-push skipped, native above still ran

  webpush.setVapidDetails(email, publicKey, privateKey)

  const supabase = createTenantAdminClient(tenantId)
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth_key')

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

  if (nativeSent > 0) console.log('[push] native fanout', { tenantId, nativeSent })
}

/**
 * Send a push to one or more specific user_ids inside a tenant. Used for
 * direct addressing (e.g. resident getting a reply). Silently no-ops when
 * VAPID isn't configured or the users have no subscriptions.
 *
 * Tenant scoping is mandatory — without it a user_id collision across
 * tenants could deliver a notification to the wrong hostel.
 */
export async function sendPushToUsers(
  tenantId: string,
  userIds: string[],
  payload: PushPayload,
): Promise<{ delivered: number; reason?: string }> {
  if (userIds.length === 0) return { delivered: 0, reason: 'no users' }

  const nativeSent = await safeNativeFanout(() =>
    Promise.all(
      userIds.map((id) =>
        fanoutToUser(id, {
          title: payload.title,
          body:  payload.body,
          path:  payload.nativePath ?? payload.url,
          data:  payload.nativeData,
        }),
      ),
    ),
  )

  const { publicKey, privateKey, email } = getVapid()
  if (!publicKey || !privateKey) {
    return nativeSent > 0
      ? { delivered: nativeSent }
      : { delivered: 0, reason: 'VAPID keys not configured' }
  }

  webpush.setVapidDetails(email, publicKey, privateKey)

  const supabase = createTenantAdminClient(tenantId)
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth_key')
    .in('user_id', userIds)

  if (!subs || subs.length === 0) {
    return nativeSent > 0
      ? { delivered: nativeSent }
      : { delivered: 0, reason: 'no active subscriptions' }
  }

  const body = JSON.stringify(payload)
  const expiredIds: string[] = []
  let delivered = nativeSent

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          body,
        )
        delivered++
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
  return { delivered }
}
