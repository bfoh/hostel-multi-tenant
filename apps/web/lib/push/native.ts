/**
 * FCM HTTP v1 sender for native mobile push.
 *
 * Handles both Android (native FCM) and iOS (APNs proxied through Firebase)
 * with one credential. iOS tokens come from `@capacitor/push-notifications`
 * after the Firebase iOS SDK relays APNs registration.
 *
 * Caller responsibilities:
 *   - Pass an array of device tokens.
 *   - On invalidTokens, delete those rows from `device_push_tokens`
 *     (see lib/push/fanout.ts).
 *
 * Required env vars:
 *   FCM_PROJECT_ID            — Firebase project id
 *   FCM_SERVICE_ACCOUNT_JSON  — Full service account JSON (stringified)
 */
import { getApps, initializeApp, cert, type App } from 'firebase-admin/app'
import { getMessaging, type Message } from 'firebase-admin/messaging'

let app: App | null = null

function getApp(): App {
  if (app) return app
  if (getApps().length > 0) {
    app = getApps()[0]!
    return app
  }
  const projectId = process.env.FCM_PROJECT_ID
  const json      = process.env.FCM_SERVICE_ACCOUNT_JSON
  if (!projectId) throw new Error('FCM_PROJECT_ID not set')
  if (!json)      throw new Error('FCM_SERVICE_ACCOUNT_JSON not set')
  const parsed = JSON.parse(json)
  app = initializeApp({
    credential: cert(parsed),
    projectId,
  })
  return app
}

export interface NativePushPayload {
  title: string
  body:  string
  /** Deep-link path inside the portal, e.g. '/owner-digest' or '/occupant-portal/invoices/abc'. */
  path?: string
  /** Arbitrary data, sent alongside `path`. All values must be strings (FCM data constraint). */
  data?: Record<string, string>
}

export interface NativeSendResult {
  sent:          number
  failed:        number
  invalidTokens: string[]
}

export async function sendToTokens(tokens: string[], payload: NativePushPayload): Promise<NativeSendResult> {
  if (tokens.length === 0) return { sent: 0, failed: 0, invalidTokens: [] }

  const messaging = getMessaging(getApp())

  const dataPayload: Record<string, string> = {
    ...(payload.data ?? {}),
    ...(payload.path ? { path: payload.path } : {}),
  }

  const messages: Message[] = tokens.map(token => ({
    token,
    notification: { title: payload.title, body: payload.body },
    data: dataPayload,
    android: {
      priority: 'high',
      notification: { sound: 'default' },
    },
    apns: {
      payload: {
        aps: { sound: 'default', 'content-available': 1 },
      },
    },
  }))

  // sendEach handles per-token results; sendAll is deprecated in firebase-admin v12+.
  const res = await messaging.sendEach(messages)
  const invalidTokens: string[] = []

  res.responses.forEach((r, i) => {
    if (!r.success) {
      const code = r.error?.code ?? ''
      if (
        code === 'messaging/registration-token-not-registered'
        || code === 'messaging/invalid-registration-token'
        || code === 'messaging/invalid-argument'
      ) {
        invalidTokens.push(tokens[i]!)
      }
    }
  })

  return {
    sent:          res.successCount,
    failed:        res.failureCount,
    invalidTokens,
  }
}
