import { SplashScreen } from '@capacitor/splash-screen'
import { setupPush } from './push'
import { setupDeepLinks, navigateWebview } from './deep-links'
import { gateBiometric } from './biometric'
import { setupCameraBridge } from './camera-bridge'
import { setupHapticsBridge } from './haptics-bridge'
import { setupAppLifecycle } from './app-lifecycle'
import { applyCachedTheme, refreshTheme } from './theming'
import { log } from './log'

const PORTAL_BASE = 'https://app.gh-hostels.com'

const BOOTED_KEY = 'gh_native_booted'

/**
 * Cold-start bootstrap. Order matters:
 *   1. Splash already showing (Capacitor)
 *   2. Apply cached theme — status bar tints to last-known tenant brand
 *      before any network call
 *   3. Biometric gate (native; skipped on non-native / no enrolment)
 *   4. Install JS bridges on `window` so the portal can call native
 *   5. Wire deep-link listener (push taps + universal links)
 *   6. Wire app-lifecycle listener (reload/reconnect after backgrounding —
 *      see app-lifecycle.ts for why this matters for realtime messaging)
 *   7. Request push permission + register token
 *   8. Resolve role → owners go to /owner-mobile, staff to /staff-mobile;
 *      occupants stay on portal default
 *   9. Refresh tenant theme in the background (cache for next cold launch)
 *  10. Hide splash so the webview takes over
 *
 * main.js is injected as a WKUserScript (see MainViewController.swift) so
 * it re-runs on EVERY in-app page navigation, not just the true cold
 * launch — Capacitor's own bridge JS works the same way. Without a guard,
 * routeByRole()'s own navigation would re-trigger this whole sequence
 * (re-prompting biometrics, re-requesting push permission, and if the
 * fetched role required a navigate, looping). sessionStorage persists
 * across same-origin in-app navigations but resets on a real cold
 * launch (new WKWebView instance), so it's the right scope for "once per
 * app session."
 */
async function main(): Promise<void> {
  if (sessionStorage.getItem(BOOTED_KEY) === '1') {
    log.info('boot: already ran this session, skipping')
    return
  }
  sessionStorage.setItem(BOOTED_KEY, '1')

  log.info('boot: start')

  await applyCachedTheme()

  const gate = await gateBiometric()
  if (gate === 'failed') log.warn('boot: biometric failed; continuing')

  setupCameraBridge()
  setupHapticsBridge()
  setupDeepLinks()
  setupAppLifecycle()

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
  tenant_role: string | null
}

async function routeByRole(): Promise<void> {
  try {
    const res = await fetch(`${PORTAL_BASE}/api/mobile/role`, { credentials: 'include' })
    if (!res.ok) {
      log.warn('routeByRole: /api/mobile/role returned non-OK', { status: res.status })
      return
    }
    const body = (await res.json()) as RoleResponse
    log.info('routeByRole: resolved', { role: body.role, tenant_role: body.tenant_role, tenant_id: body.tenant_id })
    if (body.role === 'owner') {
      navigateWebview('/owner-mobile')
      return
    }
    if (body.tenant_role && body.tenant_role !== 'owner' && body.tenant_role !== 'occupant') {
      // Staff role (manager/receptionist/housekeeper/accountant/security) —
      // route to the mobile-first staff portal rather than the desktop
      // dashboard, which was built for a mouse + wide viewport.
      navigateWebview('/staff-mobile')
      return
    }
    // Occupant: leave the webview alone — portal already lands them at /occupant-portal.
    // Unauthenticated: leave the webview alone — portal login page renders.
  } catch (err) {
    log.warn('routeByRole: skipped', { err: String(err) })
  }
}

main().catch(err => log.error('boot: fatal', err))
