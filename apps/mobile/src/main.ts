import { SplashScreen } from '@capacitor/splash-screen'
import { setupPush } from './push'
import { setupDeepLinks, navigateWebview } from './deep-links'
import { log } from './log'

/**
 * Cold-start bootstrap. Order matters:
 *   1. Splash already showing (Capacitor handles)
 *   2. Wire deep-link listener (push taps + universal links)
 *   3. Request + register push token
 *   4. Hide splash so the webview takes over
 *
 * Phase 3 inserts biometric gate + camera/haptics bridges before push.
 * Phase 4 adds role-based routing after push. Phase 5 adds cached theme
 * application first + fresh theme refresh after push.
 */
async function main(): Promise<void> {
  log.info('boot: start')

  setupDeepLinks()
  await setupPush((path) => navigateWebview(path))

  // Brief hold so the webview has time to render first paint.
  setTimeout(() => SplashScreen.hide().catch(() => undefined), 700)

  log.info('boot: done')
}

main().catch(err => log.error('boot: fatal', err))
