import { App, type URLOpenListenerEvent } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { log } from './log'

const PORTAL_BASE = 'https://app.gh-hostels.com'

/**
 * Navigate the webview to a deep-link path inside the portal.
 * We drive the webview via window.location since Capacitor exposes the
 * loaded page as the same `window`.
 */
export function navigateWebview(path: string): void {
  if (!path.startsWith('/')) {
    log.warn('deep-link: refusing non-absolute path', { path })
    return
  }
  const target = `${PORTAL_BASE}${path}`
  log.info('deep-link: navigating webview', { target })
  window.location.assign(target)
}

/**
 * Wire up iOS universal links / Android app links. For v1 (push-only deep
 * links) this is a no-op until a domain association file is published,
 * but we register the listener so future link openings work without code change.
 */
export function setupDeepLinks(): void {
  if (!Capacitor.isNativePlatform()) return
  App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
    try {
      const url = new URL(event.url)
      log.info('deep-link: appUrlOpen', { path: url.pathname })
      navigateWebview(url.pathname + url.search)
    } catch (err) {
      log.error('deep-link: parse failed', err)
    }
  })
}
