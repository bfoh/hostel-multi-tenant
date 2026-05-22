import { SplashScreen } from '@capacitor/splash-screen'
import { setupPush } from './push'
import { setupDeepLinks, navigateWebview } from './deep-links'
import { gateBiometric } from './biometric'
import { setupCameraBridge } from './camera-bridge'
import { log } from './log'

/**
 * Cold-start bootstrap. Order matters:
 *   1. Splash already showing (Capacitor)
 *   2. Biometric gate (native; skipped on non-native / no enrolment)
 *   3. Install JS bridges on `window` so the portal can call native
 *   4. Wire deep-link listener (push taps + universal links)
 *   5. Request push permission + register token
 *   6. Hide splash so the webview takes over
 *
 * Phase 4 adds role-based routing after push.
 * Phase 5 inserts cached theme apply first + fresh theme refresh after push.
 */
async function main(): Promise<void> {
  log.info('boot: start')

  const gate = await gateBiometric()
  if (gate === 'failed') log.warn('boot: biometric failed; continuing')

  setupCameraBridge()
  setupDeepLinks()
  await setupPush((path) => navigateWebview(path))

  setTimeout(() => SplashScreen.hide().catch(() => undefined), 700)
  log.info('boot: done')
}

main().catch(err => log.error('boot: fatal', err))
