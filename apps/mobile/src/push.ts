import {
  PushNotifications,
  type Token,
  type PushNotificationSchema,
  type ActionPerformed,
} from '@capacitor/push-notifications'
import { Capacitor } from '@capacitor/core'
import { log } from './log'
import { KEYS, setPref } from './storage'

const PORTAL_BASE = 'https://app.gh-hostels.com'
const APP_VERSION = '0.1.0'

type DeepLinkHandler = (path: string) => void

/**
 * Request permission, register with APNs/FCM, POST the token to
 * /api/push/register, and wire tap-handlers to the deep-link callback.
 */
export async function setupPush(onDeepLink: DeepLinkHandler): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    log.info('push: not native, skipping')
    return
  }

  const perm = await PushNotifications.requestPermissions()
  if (perm.receive !== 'granted') {
    log.warn('push: permission not granted', { perm })
    return
  }

  await PushNotifications.register()

  PushNotifications.addListener('registration', async (token: Token) => {
    log.info('push: token received', { len: token.value.length })
    await setPref(KEYS.PUSH_TOKEN, token.value)
    const platform = Capacitor.getPlatform() as 'ios' | 'android'
    try {
      const res = await fetch(`${PORTAL_BASE}/api/push/register`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ token: token.value, platform, app_version: APP_VERSION }),
      })
      log.info('push: register response', { status: res.status })
    } catch (err) {
      log.error('push: register failed', err)
    }
  })

  PushNotifications.addListener('registrationError', (err) => {
    log.error('push: registrationError', err)
  })

  PushNotifications.addListener('pushNotificationReceived', (n: PushNotificationSchema) => {
    log.info('push: received (foreground)', { title: n.title })
    // OS displays banner on Android automatically; iOS suppresses in foreground.
  })

  PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
    const path = (action.notification.data?.path as string | undefined) ?? '/'
    log.info('push: tapped', { path })
    onDeepLink(path)
  })
}
