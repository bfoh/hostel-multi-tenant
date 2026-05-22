import { SplashScreen } from '@capacitor/splash-screen'
import { setupPush } from './push'
import { setupDeepLinks, navigateWebview } from './deep-links'
import { gateBiometric } from './biometric'
import { setupCameraBridge } from './camera-bridge'
import { setupHapticsBridge } from './haptics-bridge'
import { applyCachedTheme, refreshTheme } from './theming'
import { log } from './log'

const PORTAL_BASE = 'https://app.gh-hostels.com'

/**
 * Cold-start bootstrap. Order matters:
 *   1. Splash already showing (Capacitor)
 *   2. Apply cached theme — status bar tints to last-known tenant brand
 *      before any network call
 *   3. Biometric gate (native; skipped on non-native / no enrolment)
 *   4. Install JS bridges on `window` so the portal can call native
 *   5. Wire deep-link listener (push taps + universal links)
 *   6. Request push permission + register token
 *   7. Resolve role → owners go to /owner-digest; occupants stay on portal default
 *   8. Refresh tenant theme in the background (cache for next cold launch)
 *   9. Hide splash so the webview takes over
 */
async function main(): Promise<void> {
  log.info('boot: start')

  await applyCachedTheme()

  const gate = await gateBiometric()
  if (gate === 'failed') log.warn('boot: biometric failed; continuing')

  setupCameraBridge()
  setupHapticsBridge()
  setupDeepLinks()

  await setupPush((path) => navigateWebview(path))
  await routeByRole()
  void refreshTheme()  // fire-and-forget; updates cache for next cold-launch

  setTimeout(() => SplashScreen.hide().catch(() => undefined), 700)
  log.info('boot: done')
}

interface RoleResponse {
  role:        'owner' | null
  is_occupant: boolean
  tenant_id:   string | null
}

async function routeByRole(): Promise<void> {
  try {
    const res = await fetch(`${PORTAL_BASE}/api/mobile/role`, { credentials: 'include' })
    if (!res.ok) return
    const body = (await res.json()) as RoleResponse
    if (body.role === 'owner') {
      navigateWebview('/owner-digest')
      return
    }
    // Occupant: leave the webview alone — portal already lands them at /occupant-portal.
    // Unauthenticated: leave the webview alone — portal login page renders.
  } catch (err) {
    log.warn('routeByRole: skipped', { err: String(err) })
  }
}

main().catch(err => log.error('boot: fatal', err))
